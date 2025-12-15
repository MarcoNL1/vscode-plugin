const container = document.getElementById("svgContainer");
const svg = container.querySelector("svg");

function fit() {
    if (!svg) return;

    requestAnimationFrame(() => {
        const bbox = svg.getBBox();
        if (bbox.width === 0 || bbox.height === 0) return;

        const availableW = container.parentElement.clientWidth;
        const availableH = container.parentElement.clientHeight;

        const scale = Math.min(
            availableW / bbox.width,
            availableH / bbox.height,
        );

        svg.style.transformOrigin = "center center";
        svg.style.transform = `scale(${scale})`;

    });
}

window.addEventListener("load", () => {
    fit();
    new ResizeObserver(fit).observe(container.parentElement);
});

window.addEventListener("resize", fit);
