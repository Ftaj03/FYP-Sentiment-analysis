from transformers import DebertaV2Tokenizer, AutoModelForSequenceClassification
import torch
import pandas as pd
from difflib import get_close_matches

# Load model and tokenizer
MODEL_PATH = "debert_model"
tokenizer = DebertaV2Tokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

# Define label map directly (as label_encoder.json is missing)
label_map = {
    0: "negative",
    1: "neutral",
    2: "positive"
}

ASPECT_KEYWORDS = {
    "Price": [
        "price", "affordable", "cheap", "expensive", "cost", "worth", "value", "overpriced",
        "reasonable", "pricing", "discount", "deal", "offer", "promo", "money", "expensively", "high price", "low price"
    ],
    "Packaging": [
        "packaging", "box", "packed", "packing", "wrap", "unboxing", "sealed", "well-packed",
        "bubble wrap", "box condition", "damaged box", "torn packaging", "securely packed", "neatly packed"
    ],
    "Delivery": [
        "delivery", "delivered", "shipment", "shipping", "arrived", "courier", "dispatch",
        "late", "fast delivery", "on time", "delayed", "express", "tracking", "logistics", "delivery time", "shipping cost",
        "received late", "early delivery", "package tracking", "next day delivery", "fast shipping", "delivery service"
    ],
    "Quality": [
        "quality", "material", "durability", "build", "finish", "texture", "color quality", "well-made",
        "sturdy", "broke", "broken", "fragile", "strong", "solid", "cheap material", "premium quality", "snapped", "reliable build",
        "product quality", "bad material", "inferior", "top notch", "long-lasting", "wear and tear", "scratchy"
    ],
    "Service": [
        "service", "support", "response", "customer care", "helpful", "rude", "staff", "agent",
        "call center", "representative", "live chat", "email support", "refund process", "exchange", "assistance", 
        "unresponsive", "poor service", "quick support", "complaint", "ticket", "support team"
    ],
    "Design": [
        "design", "look", "style", "appearance", "aesthetic", "beautiful", "ugly", "color", "sleek",
        "fashionable", "elegant", "modern", "outdated", "compact", "trendy", "visual", "size", "form factor"
    ],
    "Battery": [
        "battery", "charge", "charging", "power", "battery life", "drains fast", "long-lasting", "fast charging",
        "battery backup", "full charge", "battery died", "charged quickly", "low battery", "recharge", "charging time"
    ],
    "Performance": [
        "performance", "speed", "lag", "smooth", "slow", "responsive", "crash", "freeze", "bug", "glitch",
        "processing", "frame rate", "frame drops", "functionality", "snappy", "optimization", "hang", "efficiency",
        "multitasking", "load time", "update issue", "working fine"
    ],
    "Features": [
        "feature", "function", "tool", "option", "setting", "mode", "customizable", "automation", "integration",
        "compatibility", "smart", "button", "shortcut", "accessibility", "user control"
    ],
    "Usability": [
        "usability", "easy to use", "user-friendly", "interface", "navigation", "instructions", "manual",
        "complicated", "confusing", "intuitive", "setup", "installation", "configuration", "ergonomic", "learning curve"
    ],
    "Warranty": [
        "warranty", "guarantee", "return", "replacement", "refund", "policy", "coverage", "claim", "terms", "period",
        "warranty card", "money back"
    ],
    "Authenticity": [
        "authentic", "original", "genuine", "fake", "duplicate", "counterfeit", "real product", "authenticity", "verified", "trusted"
    ],
    "Availability": [
        "stock", "out of stock", "available", "sold out", "restock", "availability", "in stock", "backordered"
    ]
}

def find_mentioned_aspects(text):
    """Detect aspects in text using global ASPECT_KEYWORDS."""
    detected = set()
    text_lower = text.lower()
    for aspect, keywords in ASPECT_KEYWORDS.items():
        if any(keyword in text_lower for keyword in keywords):
            detected.add(aspect)
    return list(detected)

def analyze_aspect_sentiment(review, user_aspects=None):
    """
    Analyze sentiment for aspects in a review.
    - Uses global ASPECT_KEYWORDS for autocorrection and detection.
    """
    def autocorrect_aspect(user_aspect):
        closest = get_close_matches(user_aspect.lower(), ASPECT_KEYWORDS.keys(), n=1, cutoff=0.6)
        return closest[0] if closest else None

    # Determine aspects to analyze
    if user_aspects:
        aspects_to_analyze = [autocorrect_aspect(a) for a in user_aspects]
        aspects_to_analyze = [a for a in aspects_to_analyze if a]  # Remove invalid
        print(f"Analyzing aspects (after autocorrect): {aspects_to_analyze}")
    else:
        aspects_to_analyze = find_mentioned_aspects(review)
        print(f"Auto-detected aspects: {aspects_to_analyze}")

    # Fallback to general analysis if no aspects found
    if not aspects_to_analyze:
        inputs = tokenizer(review, return_tensors="pt", truncation=True, padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            pred_idx = torch.argmax(probs, dim=1).item()
        return [{
            "aspect": "general",
            "label": label_map[pred_idx],
            "score": float(probs[0][pred_idx])
        }]

    # Analyze each aspect
    results = []
    for aspect in aspects_to_analyze:
        input_text = f"{aspect}: {review}"
        inputs = tokenizer(input_text, return_tensors="pt", truncation=True, padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            pred_idx = torch.argmax(probs, dim=1).item()
        
        results.append({
            "aspect": aspect,
            "label": label_map[pred_idx],
            "score": float(probs[0][pred_idx])
        })

    return results