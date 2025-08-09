window.onload = async function () {
const now = new Date();
    document.getElementById("reportMonth").textContent = now.toLocaleDateString('default', { month: 'long', year: 'numeric' });

    async function fetchAndRender() {
      const reviews = JSON.parse(localStorage.getItem("reviews") || "[]");
      if (reviews.length === 0) return;

      const res = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews })
      });
      const results = await res.json();

      const sentimentSummary = { positive: 0, neutral: 0, negative: 0, total: 0 };
      const aspectStats = {};
      const aspectMentions = {};

      results.forEach(entry => {
        entry.results.forEach(r => {
          sentimentSummary[r.label]++;
          sentimentSummary.total++;

          if (!aspectStats[r.aspect]) {
            aspectStats[r.aspect] = { name: r.aspect, positive: 0, neutral: 0, negative: 0 };
            aspectMentions[r.aspect] = 0;
          }
          aspectStats[r.aspect][r.label]++;
          aspectMentions[r.aspect]++;
        });
      });

      const aspects = Object.keys(aspectStats);
      const aspectMentionsArray = aspects.map(a => aspectMentions[a]);
      const aspectStatsArray = aspects.map(a => aspectStats[a]);

      renderCharts({
        total: sentimentSummary.total,
        positive: sentimentSummary.positive,
        neutral: sentimentSummary.neutral,
        negative: sentimentSummary.negative,
        aspects,
        aspectMentions: aspectMentionsArray,
        aspectStats: aspectStatsArray
      });
    }

    function renderCharts(data) {
      const ctxDonut = document.getElementById('donutChart');
      const ctxRadar = document.getElementById('radarChart');

      new Chart(ctxDonut, {
        type: 'doughnut',
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [{
            data: [data.positive, data.neutral, data.negative],
            backgroundColor: ['#16a34a', '#ca8a04', '#dc2626']
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });

      new Chart(ctxRadar, {
        type: 'radar',
        data: {
          labels: data.aspects,
          datasets: [{
            label: 'Mentions',
            data: data.aspectMentions,
            fill: true,
            backgroundColor: 'rgba(99,102,241,0.2)',
            borderColor: '#6366f1'
          }]
        },
        options: { responsive: true, elements: { line: { borderWidth: 2 } } }
      });

      document.getElementById("totalReviews").textContent = data.total;
      document.getElementById("positiveCount").textContent = data.positive;
      document.getElementById("negativeCount").textContent = data.negative;
      document.getElementById("neutralCount").textContent = data.neutral;


      const summaryText = `Out of ${data.total} reviews, ${data.positive} (${Math.round((data.positive/data.total)*100)}%) were positive, ${data.neutral} (${Math.round((data.neutral/data.total)*100)}%) neutral, and ${data.negative} (${Math.round((data.negative/data.total)*100)}%) negative.`;
      document.getElementById("summaryText").textContent = summaryText;

      const aspectChartsDiv = document.getElementById("aspectCharts");
let rowDiv = null;

data.aspectStats.forEach((aspect, idx) => {
  if (idx % 2 === 0) {
    // Create a new row for every two charts
    rowDiv = document.createElement("div");
    rowDiv.className = "grid grid-cols-1 md:grid-cols-2 gap-6 pdf-section";
    aspectChartsDiv.appendChild(rowDiv);
  }

  const container = document.createElement("div");
  container.className = "bg-white rounded-lg shadow p-6";

  container.innerHTML = `
    <h2 class="text-xl font-semibold text-gray-700 mb-2">${aspect.name} Analysis</h2>
    <p class="text-sm text-gray-500 mb-4">
      ${aspect.name} received ${aspect.positive} positive, ${aspect.neutral} neutral, and ${aspect.negative} negative mentions.
    </p>
    <canvas id="chart-${aspect.name}"></canvas>
  `;

  rowDiv.appendChild(container);

  new Chart(container.querySelector("canvas"), {
    type: 'bar',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        label: `${aspect.name} sentiment`,
        data: [aspect.positive, aspect.neutral, aspect.negative],
        backgroundColor: ['#16a34a', '#ca8a04', '#dc2626']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, precision: 0 } }
    }
  });
});
}


    await fetchAndRender();;
};
async function downloadPDF() {
  const reportElement = document.getElementById("report");

  // Scroll to top
  window.scrollTo(0, 0);

  // Wait for rendering/layout completion
  await new Promise(resolve => setTimeout(resolve, 300));

  const canvas = await html2canvas(reportElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff"
  });

  const imgData = canvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgProps = pdf.getImageProperties(imgData);

  const imgWidth = pageWidth;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  let heightLeft = imgHeight;
  let position = 0;

  // First page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // Add additional pages if needed
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`SentiScope_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}