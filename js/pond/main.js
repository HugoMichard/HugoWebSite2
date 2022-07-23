const FishPond = require('./fish_pond.js');

const canvas = document.getElementById("pond");
let pond = new FishPond(window);

function clickCanvas(e) {
    const x = e.clientX - canvas.offsetLeft;
    const y = e.clientY - canvas.offsetTop;
    pond.click(x,y);
}

canvas.addEventListener('click', clickCanvas);

pond.start(canvas);
