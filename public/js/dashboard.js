// dashboard.js - Main dashboard functionality

let charts = {};
let refreshInterval;

// Check authentication on page load
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        if (!response.ok || !data.authenticated) {
            window.location.href = 'index.html';
            return;
        }
        
        // Set user name
        document.getElementById('userName').textContent = `Welcome, ${data.user.name}`;
        
        // Show admin button if user is admin
        if (data.user.role === 'admin') {
            document.getElementById('adminBtn').style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'index.html';
    }
}

// Fetch sensor data
async function fetchSensorData() {
    try {
        const response = await fetch('/api/sensors');
        const data = await response.json();
        
        if (response.ok) {
            updateSummaryCards(data.latest);
            updateCharts(data.history);
            updateTable(data.recent);
            
            // Update last update time
            document.getElementById('lastUpdate').textContent = new Date().toLocaleString();
        }
    } catch (error) {
        console.error('Failed to fetch sensor data:', error);
    }
}

// Update summary cards with latest values
function updateSummaryCards(latest) {
    if (!latest) return;
    
    // Update only the 3 fields we have
    document.getElementById('tempValue').textContent = latest.field1?.toFixed(1) || '--';
    document.getElementById('humidityValue').textContent = latest.field2?.toFixed(1) || '--';
    document.getElementById('pm25Value').textContent = latest.field3?.toFixed(0) || '--';
    
    // Hide the cards we don't use
    document.getElementById('pm10Value').textContent = '--';
    document.getElementById('co2Value').textContent = '--';
}

// Update charts with historical data
function updateCharts(history) {
    if (!history || history.length === 0) return;
    
    const timestamps = history.map(d => new Date(d.timestamp).toLocaleTimeString());
    
    // Field1 & Field2 Chart
    updateOrCreateChart('tempHumidityChart', {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: 'Field 1',
                    data: history.map(d => d.field1),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Field 2',
                    data: history.map(d => d.field2),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
    
    // Field3 Chart
    updateOrCreateChart('pmChart', {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: 'Field 3',
                    data: history.map(d => d.field3),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Combined View Chart
    updateOrCreateChart('co2Chart', {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: 'Field 1',
                    data: history.map(d => d.field1),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Field 2',
                    data: history.map(d => d.field2),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Field 3',
                    data: history.map(d => d.field3),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Helper function to create or update chart
function updateOrCreateChart(canvasId, config) {
    if (charts[canvasId]) {
        // Update existing chart
        charts[canvasId].data = config.data;
        charts[canvasId].update();
    } else {
        // Create new chart
        const ctx = document.getElementById(canvasId).getContext('2d');
        charts[canvasId] = new Chart(ctx, config);
    }
}

// Update data table
function updateTable(recent) {
    if (!recent || recent.length === 0) return;
    
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    recent.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(row.timestamp).toLocaleString()}</td>
            <td>${row.field1?.toFixed(1) || '--'}</td>
            <td>${row.field2?.toFixed(1) || '--'}</td>
            <td>${row.field3?.toFixed(0) || '--'}</td>
            <td>--</td>
            <td>--</td>
        `;
        tbody.appendChild(tr);
    });
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await fetch('/api/logout');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
});

// Admin button
document.getElementById('adminBtn').addEventListener('click', () => {
    window.location.href = 'admin.html';
});

// Initialize
checkAuth();
fetchSensorData();

// Auto-refresh every 30 seconds
refreshInterval = setInterval(fetchSensorData, 30000);