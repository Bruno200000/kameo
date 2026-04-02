document.addEventListener('DOMContentLoaded', () => {
    
    // Navigation Simple (Mock)
    const navItems = document.querySelectorAll('.nav-item');
    const pageTitle = document.getElementById('pageTitle');
    const pageContent = document.getElementById('pageContent');
    const dashboardHTML = pageContent.innerHTML; // Save dashboard content
    const productsTemplate = document.getElementById('productsTemplate').innerHTML;
    const posTemplate = document.getElementById('posTemplate').innerHTML;
    const stockTemplate = document.getElementById('stockTemplate').innerHTML;
    const salesTemplate = document.getElementById('salesTemplate').innerHTML;
    const purchasesTemplate = document.getElementById('purchasesTemplate').innerHTML;
    const contactsTemplate = document.getElementById('contactsTemplate').innerHTML;
    const settingsTemplate = document.getElementById('settingsTemplate').innerHTML;
    const subscriptionTemplate = document.getElementById('subscriptionTemplate').innerHTML;

    const templates = {
        'dashboard': dashboardHTML,
        'products': productsTemplate,
        'pos': posTemplate,
        'stock': stockTemplate,
        'sales': salesTemplate,
        'purchases': purchasesTemplate,
        'contacts': contactsTemplate,
        'settings': settingsTemplate,
        'subscription': subscriptionTemplate
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Highlight active nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Change Page Title
            const targetPage = item.getAttribute('data-page');
            pageTitle.textContent = item.textContent.trim();

            // Render content mock
            if (templates[targetPage]) {
                pageContent.innerHTML = templates[targetPage];
            } else {
                pageContent.innerHTML = `
                    <div class="card" style="padding: 40px; text-align: center;">
                        <i data-feather="settings" style="width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 16px;"></i>
                        <h2>Page en construction</h2>
                        <p class="text-muted">Ceci est une route inconnue pour le moment.</p>
                    </div>
                `;
            }
            feather.replace();
        });
    });

});
