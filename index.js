// script.js
  // Character count for review textarea
  document.getElementById('reviewInput').addEventListener('input', function() {
    document.getElementById('charCount').textContent = this.value.length + ' characters';
  });

  // Aspect management functions
  function addAspect(type) {
    const inputId = type === 'single' ? 'singleAspectInput' : 'bulkAspectInput';
    const listId = type === 'single' ? 'singleAspectList' : 'bulkAspectList';
    
    const aspectInput = document.getElementById(inputId);
    const aspectList = document.getElementById(listId);
    
    if (aspectInput.value.trim() === '') return;
    
    const aspect = aspectInput.value.trim();
    aspectInput.value = '';
    
    const aspectItem = document.createElement('li');
    aspectItem.className = 'bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm flex items-center gap-1';
    aspectItem.innerHTML = `
      ${aspect}
      <button onclick="this.parentElement.remove()" class="text-indigo-500 hover:text-indigo-700">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    
    aspectList.appendChild(aspectItem);
  }

  // Get all aspects from a list
  function getAspects(listId) {
    const aspectList = document.getElementById(listId);
    return Array.from(aspectList.children).map(li => 
      li.textContent.trim().replace('×', '').trim()
    );
  }

  // Analyze single review
  async function analyzeSingle() {
  const reviewText = document.getElementById('reviewInput').value.trim();
  const productName = document.getElementById('productName').value.trim();
  const aspects = getAspects('singleAspectList');
  
  if (!reviewText) {
    alert('Please enter a review to analyze');
    return;
  }

  const review = {
    text: reviewText,
    product: productName || 'Unknown Product',
    aspects: aspects.length > 0 ? aspects : null
  };

  try {
    // Show loading state
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = `Analyzing...`;

    console.log("Sending to backend:", { reviews: [review] }); // Debug log
    
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ reviews: [review] })
    });

    console.log("Response status:", response.status); // Debug log
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${errorText}`);
    }

    const data = await response.json();
    console.log("Analysis results:", data); // Debug log

    localStorage.setItem('reviews', JSON.stringify([review]));
    localStorage.setItem('analysisResults', JSON.stringify(data));
    window.location.href = 'result.html';
    
  } catch (error) {
    console.error("Full error:", error);
    alert(`Analysis failed: ${error.message}`);
  } finally {
    const analyzeBtn = document.querySelector('#analyzer-single button');
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = `Analyze Sentiment`;
    }
  }
}

// Analyze CSV file
async function analyzeCSV() {
  try {
    // 1. Get the file input and button elements
    const fileInput = document.getElementById('csvInput');
    const analyzeBtn = document.getElementById('analyzeCsvBtn');
    
    // 2. Check if elements exist
    if (!fileInput || !analyzeBtn) {
      throw new Error("Required elements not found");
    }

    // 3. Validate file selection
    if (!fileInput.files || fileInput.files.length === 0) {
      throw new Error("Please select a CSV file first");
    }

    // 4. Get the selected file
    const file = fileInput.files[0]; // This is where 'file' gets defined
    
    // 5. Set loading state
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Processing...
    `;

    // 6. Process the file
    const reviews = await readCSV(file);
    
    if (reviews.length === 0) {
      throw new Error("No valid reviews found in CSV");
    }

    // 7. Send to backend
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Server error");
    }

    const data = await response.json();
    
    // 8. Store results and redirect
    localStorage.setItem('reviews', JSON.stringify(reviews));
    localStorage.setItem('analysisResults', JSON.stringify(data));
    window.location.href = 'result.html';

  } catch (error) {
    console.error('CSV processing error:', error);
    alert(`Error: ${error.message}`);
  } finally {
    const analyzeBtn = document.getElementById('analyzeCsvBtn');
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        Upload & Analyze
      `;
    }
  }
}

// Helper function to read CSV
function readCSV(file) {  // 'file' parameter is properly defined here
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const lines = content.split('\n')
          .filter(line => line.trim() !== '')
          .map(line => ({
            text: line.split(',')[0]?.trim() || line.trim(),
            product: 'Bulk Review',
            aspects: [] // Add aspects if needed
          }));
        
        resolve(lines);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsText(file);
  });
}

  // Add event listeners
  document.addEventListener('DOMContentLoaded', function() {
    // Add drag and drop for CSV file
    const dropArea = document.querySelector('.border-dashed');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
      dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
      dropArea.classList.add('border-indigo-400', 'bg-indigo-50');
    }
    
    function unhighlight() {
      dropArea.classList.remove('border-indigo-400', 'bg-indigo-50');
    }
    
    dropArea.addEventListener('drop', function(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      document.getElementById('csvInput').files = files;
    });
  });
