function randomizeShapes() {
    const shapes = document.querySelectorAll('.shape');
    shapes.forEach(shape => {
        shape.style.left = Math.floor(Math.random() * 100) + '%';
        shape.style.animationDelay = Math.random() * -20 + 's';
    });
}

document.addEventListener('DOMContentLoaded', randomizeShapes);
