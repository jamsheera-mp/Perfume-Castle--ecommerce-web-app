let salesChart;

function initializeSalesChart(initialData) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: initialData.map(item => item._id),
            datasets: [{
                label: 'Total Sales (₹)',
                data: initialData.map(item => item.totalSales),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                yAxisID : 'y'
            }, {
                label: 'Order Count',
                data: initialData.map(item => item.orderCount),
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
                yAxisID : 'y1'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Total Sales (₹)'
                }
            },
            y1:{
                type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Order Count'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
            }
        }
        }
    });
}

document.getElementById('timeFrame').addEventListener('change', async (e) => {
    const period = e.target.value;
    try {
        // Show loading state
        if (salesChart) {
            salesChart.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            salesChart.update('none');
        }

        // Fetch all dashboard data
        const [salesResponse, productsResponse, categoriesResponse, brandsResponse] = await Promise.all([
            fetch(`/admin/dashboard/update-sales?period=${period}`),
            fetch(`/admin/dashboard/update-top-products?period=${period}`),
            fetch(`/admin/dashboard/update-top-categories?period=${period}`),
            fetch(`/admin/dashboard/update-top-brands?period=${period}`)
        ]);

        // Check if all responses are ok
        if (!salesResponse.ok || !productsResponse.ok || !categoriesResponse.ok || !brandsResponse.ok) {
            throw new Error('One or more requests failed');
        }

        // Parse all responses
        const [salesData, topProducts, topCategories, topBrands] = await Promise.all([
            salesResponse.json(),
            productsResponse.json(),
            categoriesResponse.json(),
            brandsResponse.json()
        ]);

        // Update all dashboard components
        updateSalesChart(salesData);
        updateTopProductsList(topProducts);
        updateTopCategoriesList(topCategories);
        updateTopBrandsList(topBrands);

    } catch (error) {
        console.error('Error updating dashboard:', error);
        // Show error message to user
        alert('Failed to update dashboard data. Please try again.');
    }
});


function formatWeekLabel(dateStr) {
    const date = new Date(dateStr);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)

    // Format dates
    const startMonth = weekStart.toLocaleString('default', { month: 'short' });
    const endMonth = weekEnd.toLocaleString('default', { month: 'short' });
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();

    // If start and end dates are in the same month
    if (startMonth === endMonth) {
        return `${startMonth} ${startDay}-${endDay}`;
    }
    // If they span different months
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}


function updateSalesChart(newData) {
    if (!salesChart) return;

    // Format dates based on selected period
    const period = document.getElementById('timeFrame').value;
    const formattedLabels = newData.map(item => {
        const date = new Date(item._id);
        switch (period) {
            case 'daily':
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                })
            case 'weekly':
                return formatWeekLabel(item._id);
            case 'monthly':
                return date.toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric'
                });
            case 'yearly':
                return date.getFullYear().toString();
            default:
                return item._id;
        }
    });

    salesChart.data.labels = formattedLabels;
    salesChart.data.datasets[0].data = newData.map(item => item.totalSales);
    salesChart.data.datasets[1].data = newData.map(item => item.orderCount);
    salesChart.update();
}


function updateTopProductsList(products) {
    const productsList = document.querySelector('.card-body ul.list-group');
    if (!productsList) return;

    productsList.innerHTML = products.map((product, index) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            ${index + 1}. ${product.productName}
            <span class="badge bg-primary rounded-pill">₹${product.totalRevenue.toLocaleString()} (${product.salesCount} sales)</span>
        </li>
    `).join('');
}

function updateTopCategoriesList(categories) {
    const categoriesList = document.querySelectorAll('.card-body ul.list-group')[1];
    if (!categoriesList) return;

    categoriesList.innerHTML = categories.map((category, index) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            ${index + 1}. ${category.name}
            <span class="badge bg-success rounded-pill">₹${category.totalRevenue.toLocaleString()} (${category.salesCount} sales)</span>
        </li>
    `).join('');
}

function updateTopBrandsList(brands) {
    const brandsList = document.querySelectorAll('.card-body ul.list-group')[2];
    if (!brandsList) return;

    brandsList.innerHTML = brands.map((brand, index) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            ${index + 1}. ${brand.brandName}
            <span class="badge bg-warning rounded-pill">₹${brand.totalRevenue.toLocaleString()} (${brand.salesCount} sales)</span>
        </li>
    `).join('');
}
