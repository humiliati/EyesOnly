document.addEventListener('DOMContentLoaded', () => {
    const iframe = document.getElementById('designer-iframe');
    const navButtons = document.querySelectorAll('.nav-btn');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const designer = btn.dataset.designer;
            iframe.src = `${designer}-designer.html`;

            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
});
