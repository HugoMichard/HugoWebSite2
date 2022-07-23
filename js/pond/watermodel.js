class WaterCanvas {
    constructor(pond, waterModel, props) {

        // If a certain property is not set, use a default value
        props = props || {};
        this.lightRefraction 	= props.lightRefraction 	|| 9.0;
        this.lightReflection	= props.lightReflection 	|| 0.1;

        this.pond = pond;
        this.waterModel = waterModel;
        
        this.canvas = document.getElementById('pond');  
        this.canvasHelp = document.getElementById('pond');

        if(!this.canvas.getContext || !this.canvasHelp.getContext){ 
            alert("You need a browser that supports the HTML5 canvas tag.");
            return; // No point to continue
        }

        this.ctx = this.canvas.getContext('2d');  
        this.ctxHelp = this.canvasHelp.getContext('2d');
    }
    render() {
        if(!this.waterModel.isEvolving()){
            // Wait some time and try again
            var self = this; 
            
            // Nothing else to do for now
            return;
        }
                
        // Make the canvas give us a CanvasDataArray. 
        // Creating an array ourselves is slow!!!
        // https://developer.mozilla.org/en/HTML/Canvas/Pixel_manipulation_with_canvas
        var imgDataOut = this.ctx.getImageData(0, 0, this.pond.width, this.pond.height);
		this.pixelsIn = new Uint8ClampedArray(imgDataOut.data);
        var pixelsOut = imgDataOut.data;
        for (var i = 0; n = pixelsOut.length, i < n; i += 4) {
            var pixel = i/4;
            var x = pixel % this.pond.width;
            var y = (pixel-x) / this.pond.width;
            
            var strength = this.waterModel.getWater(x,y);
            // Refraction of light in water

			var refraction = Math.round(strength * this.lightRefraction);

			var xPix = x + refraction;
            var yPix = y + refraction;     
            
            if(xPix < 0) xPix = 0;
            if(yPix < 0) yPix = 0;
            if(xPix > this.pond.width-1) xPix = this.pond.width-1;
            if(yPix > this.pond.height-1) yPix = this.pond.height-1;			

			// Get the pixel from input
            var iPix = ((yPix * this.pond.width) + xPix) * 4;

			var red 	= this.pixelsIn[iPix  ];
            var green 	= this.pixelsIn[iPix+1];
            var blue 	= this.pixelsIn[iPix+2];

			// Set the pixel to output
            strength *= this.lightReflection;
            strength += 1.0;
    
            pixelsOut[i  ] = red *= strength;
            pixelsOut[i+1] = green *= strength;
            pixelsOut[i+2] = blue *= strength;
            pixelsOut[i+3] = 255; // alpha 
        }
    
        this.ctx.putImageData(imgDataOut, 0,0);

        // Make the browser call this function at a new render frame
        var self = this; // For referencing 'this' in internal eventListeners
    }
    setLightRefraction(lightRefraction){
        this.lightRefraction = lightRefraction;	
    }
    setLightReflection(lightReflection){
        this.lightReflection = lightReflection;	
    }

}

class WaterModel {
	constructor(width, height, props) {
		// If a certain property is not set, use a default value
		props = props || {};
		this.resolution 		= props.resolution 		|| 2.0;
		this.interpolate 		= props.interpolate 	|| false;
		this.damping 			= props.damping 		|| 0.985;
		this.clipping 			= props.clipping 		|| 5;	
		this.maxFps 			= props.maxFps 			|| 30;
		this.evolveThreshold 	= props.evolveThreshold	|| 0.05;

		this.width = Math.ceil(width/this.resolution);
		this.height = Math.ceil(height/this.resolution);

		this.resetSizeAndResolution(width, height, this.resolution)

		// Create water model 2D arrays
		this.swapMap;

		this.setMaxFps(this.maxFps);

		this.evolving = false; // Holds whether it's needed to render frames
	}

	getWater(x, y) {
		let xTrans = x/this.resolution;
		let yTrans = y/this.resolution;
		if(!this.interpolate || this.resolution==1.0){
			let xF = Math.floor(xTrans); 
			let yF = Math.floor(yTrans);	
	
			if(xF>this.width-1 || yF>this.height-1)
				return 0.0;

			return this.depthMap1[xF][yF];
		}
		
		
		// Else use Bilinear Interpolation
		let xF = Math.floor(xTrans); 
		let yF = Math.floor(yTrans);
		let xC = Math.ceil(xTrans); 
		let yC = Math.ceil(yTrans);	
	
		if(xC>this.width-1 || yC>this.height-1)
			return 0.0;

		// Now get 4 points from the array
		var br = this.depthMap1[xF][yF];
		var bl = this.depthMap1[xC][yF];
		var tr = this.depthMap1[xF][yC];
		var tl = this.depthMap1[xC][yC];
		
		// http://tech-algorithm.com/articles/bilinear-image-scaling/
		//	D   C
		//	  Y
		//	B	A
		// Y = A(1-w)(1-h) + B(w)(1-h) + C(h)(1-w) + Dwh
	
		var xChange = xC - xTrans;
		var yChange = yC - yTrans;
		var intpVal =
				tl*(1-xChange)	*	(1-yChange) +  
				tr*(xChange)	*	(1-yChange) +
				bl*(yChange)	*	(1-xChange) +  
				br*xChange		*	yChange;
	
		return intpVal;
	}

	setInterpolation(interpolate) {
		this.interpolate = interpolate;
	}

	touchWater(x, y, pressure, array2d) {
		this.evolving = true;

		x = Math.floor(x/this.resolution); 
		y = Math.floor(y/this.resolution);
		
		// Place the array2d in the center of the mouse position
		if(array2d.length>4 || array2d[0].length>4){
			x-=array2d.length/2;
			y-=array2d[0].length/2;
		}
		
		if(x<0) x = 0;
		if(y<0) y = 0;
		if(x>this.width) x = this.width;
		if(y>this.height) y = this.height;
	
		// Big pixel block
		for(var i = 0; i < array2d.length; i++){
			for(var j = 0; j < array2d[0].length; j++){
	
				if(x+i>=0 && y+j>=0 && x+i<=this.width-1 && y+j<=this.height-1) {
					this.depthMap1[x+i][y+j] -= array2d[i][j] * pressure;
				}
				
			}
		}
	}

	renderNextFrame() {
		if(!this.evolving)
			return;

		this.evolving = false;
		
		for (var x = 0; x < this.width; x++) {
			for (var y = 0; y < this.height; y++) {

				// Handle borders correctly
				var val = 	(x==0 				? 0 : this.depthMap1[x - 1][y]) +
							(x==this.width-1 	? 0 : this.depthMap1[x + 1][y]) +
							(y==0 				? 0 : this.depthMap1[x][y - 1]) +
							(y==this.height-1 	? 0 : this.depthMap1[x][y + 1]);

				// Damping
				val = ((val / 2.0) - this.depthMap2[x][y]) * this.damping;
				
				// Clipping prevention
				if(val>this.clipping) val = this.clipping;
				if(val<-this.clipping) val = -this.clipping;
				
				// Evolve check
				if(Math.abs(val)>this.evolveThreshold) 
					this.evolving = true; 

				
				this.depthMap2[x][y] = val;
			}
		}

		// Swap buffer references
		this.swapMap 	= this.depthMap1;
		this.depthMap1 	= this.depthMap2;
		this.depthMap2 	= this.swapMap;
		
		this.fpsCounter++;
	}

	isEvolving() {
		return this.evolving;
	}
	setMaxFps(maxFps) {
		this.maxFps = maxFps;
	
		clearInterval(this.maxFpsInterval);
	
		// Updating of the animation
		var self = this; // For referencing 'this' in internal eventListeners	
		
		if(this.maxFps>0){
			this.maxFpsInterval = setInterval(function(){
				self.renderNextFrame();
			}, 1000/this.maxFps); 	
		}
	}
	setDamping(damping) {
		this.damping = damping
	}
	resetSizeAndResolution(width, height, resolution) {
		this.width = Math.ceil(width/resolution);
		this.height = Math.ceil(height/resolution);
		this.resolution = resolution;
		
		this.depthMap1 = new Array(this.width); 
		this.depthMap2 = new Array(this.width);
		for(var x = 0; x < this.width; x++){
			this.depthMap1[x] = new Array(this.height);
			this.depthMap2[x] = new Array(this.height);
			
			for (var y = 0; y < this.height; y++) {
				this.depthMap1[x][y] = 0.0;
				this.depthMap2[x][y] = 0.0;
			}
		}
	}

	resetSizeAndResolution(width, height, resolution){
		this.width = Math.ceil(width/resolution);
		this.height = Math.ceil(height/resolution);
		this.resolution = resolution;
		
		this.depthMap1 = new Array(this.width); 
		this.depthMap2 = new Array(this.width);
		for(var x = 0; x < this.width; x++){
			this.depthMap1[x] = new Array(this.height);
			this.depthMap2[x] = new Array(this.height);
			
			for (var y = 0; y < this.height; y++) {
				this.depthMap1[x][y] = 0.0;
				this.depthMap2[x][y] = 0.0;
			}
		}
	}
}




////////////////////////////////////////////////////////////////////////////////
//                                 Util functions                             //
////////////////////////////////////////////////////////////////////////////////

/**
 * A class to mimic rain on the given waterModel with raindrop2dArray's as raindrops.
 */
class RainMaker {
	constructor(width, height, waterModel, raindrop2dArray) {
		this.width = width;
		this.height = height;
		this.waterModel = waterModel;
		this.raindrop2dArray = raindrop2dArray;
	
		this.rainMinPressure = 1;
		this.rainMaxPressure = 3;
	}
	raindrop() {
		var x = Math.floor(Math.random() * this.width);
		var y = Math.floor(Math.random() * this.height);
		this.waterModel.touchWater(x, y, this.rainMinPressure + Math.random() * this.rainMaxPressure, this.raindrop2dArray);
	}
	setRaindropsPerSecond(rps) {
		this.rps = rps;
	
		clearInterval(this.rainInterval);
	
		if(this.rps>0) {
			var self = this; 
			this.rainInterval = setInterval(function(){
				self.raindrop();
			}, 1000/this.rps); 	
		}
	}

	setRainMinPressure(rainMinPressure){
		this.rainMinPressure = rainMinPressure;
	}

	setRainMaxPressure(rainMaxPressure){
		this.rainMaxPressure = rainMaxPressure;
	}
}	


/**
 * Enables mouse interactivity by adding event listeners to the given documentElement and
 * using the mouse coordinates to 'touch' the water.
 */
function enableMouseInteraction(waterModel){		
	var mouseDown = false;
	
	var canvasHolder = document.getElementById("pond");
	
	canvasHolder.addEventListener("mousedown", function(e){
		mouseDown = true;
		var x = (e.clientX - canvasHolder.offsetLeft) + document.body.scrollLeft + document.documentElement.scrollLeft;
		var y = (e.clientY - canvasHolder.offsetTop) + document.body.scrollTop + document.documentElement.scrollTop;
		waterModel.touchWater(x, y, 1.5, mouseDown ? finger : pixel);
	}, false);
	
	canvasHolder.addEventListener("mouseup", function(e){
		mouseDown = false;
	}, false);
	
	canvasHolder.addEventListener("mousemove", function(e){
		var x = (e.clientX - canvasHolder.offsetLeft) + document.body.scrollLeft + document.documentElement.scrollLeft;
		var y = (e.clientY - canvasHolder.offsetTop) + document.body.scrollTop + document.documentElement.scrollTop;
		// mozPressure: https://developer.mozilla.org/en/DOM/Event/UIEvent/MouseEvent
		waterModel.touchWater(x, y, 1.5, mouseDown ? finger : pixel);
	}, false);
}

/**
 * Creates a canvas with a radial gradient from white in the center to black on the outside.
 */
function createRadialCanvas(width, height){
	// Create a canvas
	var pointerCanvas = document.createElement('canvas');  
	pointerCanvas.setAttribute('width', width);  
	pointerCanvas.setAttribute('height', height);  
	pointerCtx = pointerCanvas.getContext('2d'); 
	
	// Create a drawing on the canvas
	var radgrad = pointerCtx.createRadialGradient(width/2,height/2,0,  width/2,height/2,height/2);
	radgrad.addColorStop(0, '#fff');
	radgrad.addColorStop(1, '#000');

	pointerCtx.fillStyle = radgrad;
	pointerCtx.fillRect(0,0,width,height);	
	
	return pointerCanvas;
}

/**	
 * Creates a 2D pointer array from a given canvas with a grayscale image on it. 
 * This canvas image is then converted to a 2D array with values between -1.0 and 0.0.
 * 
 * Example:
 * 	var array2d = [
 * 		[0.5, 1.0, 0.5], 
 * 		[1.0, 1.0, 1.0], 
 * 		[0.5, 1.0, 0.5]
 * 	];
 */
function create2DArray(canvas){
	var width = canvas.width;
	var height = canvas.height;

	// Create an empty 2D  array
	var pointerArray = new Array(width); 
	for(var x = 0; x < width; x++){
		pointerArray[x] = new Array(height);
		for (var y = 0; y < height; y++) {
			pointerArray[x][y] = 0.0;
		}
	}

	// Convert gray scale canvas to 2D array
	var pointerCtx = canvas.getContext('2d'); 
	var imgData = pointerCtx.getImageData(0, 0, width, height);
	var pixels = imgData.data;	

	for (var i = 0; n = pixels.length, i < n; i += 4) {				
		// Get the pixel from input
		var pixVal 	= pixels[i];// only use red
		var arrVal = pixVal/255.0;

		var pixel = i/4;
		var x = pixel % width;
		var y = (pixel-x) / width;

		pointerArray[x][y] = arrVal;
	}				
	
	return pointerArray;			
}

module.exports = { create2DArray, createRadialCanvas, RainMaker, WaterCanvas, WaterModel, enableMouseInteraction }

const pixel = create2DArray(createRadialCanvas(2,2));
const finger = create2DArray(createRadialCanvas(14,14));
