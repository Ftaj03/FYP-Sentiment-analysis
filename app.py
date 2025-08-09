from flask import Flask, json, request, jsonify
from flask_cors import CORS
from model_server import analyze_aspect_sentiment, find_mentioned_aspects
import pandas as pd
import json as json_lib

app = Flask(__name__)
CORS(app)

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    print("Received data:", data)  # Debug input
    
    if not data or "reviews" not in data:
        return jsonify({"error": "No reviews provided"}), 400

    all_results = []
    for review_data in data["reviews"]:
        # Handle both string (simple review) and object (with aspects)
        if isinstance(review_data, str):
            review_text = review_data
            user_aspects = []
        else:
            review_text = review_data.get("text", "")
            user_aspects = review_data.get("aspects", [])
        
        if not review_text:
            continue
            
        results = analyze_aspect_sentiment(review_text, user_aspects)
        all_results.append({
            "review": review_text,
            "results": results,
            "product": review_data.get("product", "Unknown Product") if isinstance(review_data, dict) else "Unknown Product"
        })

    return jsonify(all_results)

@app.route("/analyze_csv", methods=["POST"])
def analyze_csv():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        
        # Get user aspects from form data
        user_aspects = request.form.getlist("userAspects[]")
        if 'userAspects' in request.form:
            try:
                user_aspects = json_lib.loads(request.form['userAspects'])
                if not isinstance(user_aspects, list):
                    user_aspects = [user_aspects] if user_aspects else []
            except json_lib.JSONDecodeError:
                user_aspects = []
        
        print(f"Analyzing CSV with aspects: {user_aspects}")  # Debug

        df = pd.read_csv(file)
        
        # Find review column
        normalized_cols = {col.lower().strip(): col for col in df.columns}
        review_col = None
        for possible in ['review', 'text', 'comment', 'feedback']:
            if possible in normalized_cols:
                review_col = normalized_cols[possible]
                break

        if not review_col:
            return jsonify({'error': "Could not find review column in CSV"}), 400

        reviews = df[review_col].dropna().astype(str).tolist()
        all_results = []
        
        for review in reviews:
            results = analyze_aspect_sentiment(review, user_aspects)
            all_results.append({
                "review": review,
                "results": results,
                "analyzed_aspects": user_aspects if user_aspects else find_mentioned_aspects(review)
            })

        return jsonify({
            "data": all_results,
            "total_reviews": len(reviews),
            "analyzed_aspects": user_aspects if user_aspects else ["auto-detected"]
        })
        
    except Exception as e:
        print(f"Error in CSV analysis: {str(e)}")  # Debug
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)