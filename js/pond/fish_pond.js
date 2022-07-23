const Fish = require('./fish');
const Target = require('./target');
const water = require('./watermodel.js')


class FishPond {
  constructor(window){
    this.var=0.001;
    this.maxFood=30;
    this.maxFish=30;
    this.window=window;
    this.height = this.window.innerHeight;
    this.width = this.window.innerWidth;
    this.vh = this.height/100;
    this.vw = this.width/100;
    this.c=0;
    this.base_image = new Image();
    this.base_image.src = 'imgs/texture2.png';
    this.texture_image = new Image();
    this.texture_image.src = 'imgs/texture3.jpg';
    this.spots=[new Target(0,0,0)];
    for(let i = 1;i < 100;i++)
      this.spots.push(new Target(0,0,0,this.spots[i-1]));
    this.spots[0].nextSpot=this.spots[this.spots.length - 1];

    const halfh=this.height/2;
    const halfw=this.width/2;
    for(let i = 0;i < Math.floor(this.spots.length) / 2;i++){
      this.spots[i].x = halfw + ( Math.random() * halfw)*Math.cos(i);
      this.spots[i].y = halfh + ( Math.random() * halfh)*Math.sin(i);
    }
    for(let i = Math.floor(this.spots.length / 2);i < this.spots.length;i++){
      this.spots[i].x = halfw + (halfw/4 + Math.random() * halfw/1.5)*Math.cos(-i);
      this.spots[i].y = halfh + (halfh/3 + Math.random() * halfh/2)*Math.sin(-i);
    }

    this.foods=[];
    this.fish=[];
    let fishCount = 5;
    this.ripples=[];

    this.numberOfFish = fishCount;
    for(let i = 0;i < fishCount;i++)
      this.addFish();
  }

  start(canvas){
    const h = this.height;
    const w = this.width;
    this.height = this.window.innerHeight - 20;
    this.width = this.window.innerWidth - 20;
    canvas.height = this.window.innerHeight - 20;
    canvas.width = this.window.innerWidth - 20;

    console.log("INITIALIZING WATER MODEL")
    var waterModel = new water.WaterModel(this.width, this.height, {
			resolution:3.0,
			interpolate:false,
			damping:0.985,
			clipping:5,
			evolveThreshold:0.05,
      maxFps: 20
		});
    console.log("INITIALIZING WATER CANVAS")

    this.watercanvas = new water.WaterCanvas(this, waterModel, {
      lightRefraction:20.0,
			lightReflection:0.1,
    });
    console.log("INITIALIZING RAIN DROPS")

    var raindrop 	= water.create2DArray(water.createRadialCanvas(4,4));
    var rainMaker = new water.RainMaker(this.width, this.height, waterModel, raindrop);
    rainMaker.setRaindropsPerSecond(1);
    water.enableMouseInteraction(waterModel);

    const ctx = canvas.getContext("2d");

    const startAnimation = () => {
      this.vh = this.height/100;
      this.vw = this.width/100;

      if(w !== this.width || h !== this.height){
        const halfh=this.height/2;
        const halfw=this.width/2;
        for(let i = 0;i < Math.floor(this.spots.length) / 2;i++){
          this.spots[i].x = halfw + ( Math.random() * halfw)*Math.cos(i);
          this.spots[i].y = halfh + ( Math.random() * halfh)*Math.sin(i);
        }
        for(let i = Math.floor(this.spots.length / 2);i < this.spots.length;i++){
          this.spots[i].x = halfw + (halfw/4 + Math.random() * halfw/1.5)*Math.cos(-i);
          this.spots[i].y = halfh + (halfh/3 + Math.random() * halfh/2)*Math.sin(-i);
        }
      }

      this.render(ctx);

      setTimeout(startAnimation, 20);
    };
    const addExtraFish = () => {
        if(this.numberOfFish < this.maxFish) {
            this.addFish();
            this.numberOfFish += 1;
        }
        setTimeout(addExtraFish, 1000 * 10);
    }

    startAnimation();
    addExtraFish();
  }

  render(ctx){
    ctx.globalAlpha = 1;
    ctx.drawImage(this.base_image, 0, 0, this.width, this.height);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(this.texture_image, 0, 0, this.width, this.height);
    ctx.globalAlpha = 0.9;

    this.fish.sort((a,b)=>b.mass-a.mass);
    for(let i = 0;i < this.fish.length;i++)
      this.fish[i].render(ctx);
    for(let i = 0;i < this.foods.length;i++)
      this.foods[i].render(ctx);
    this.watercanvas.render();

    this.fontSize = this.vh*10;
    if(this.width/20 < this.fontSize)
      this.fontSize = this.vw*5;
  }
  click(x,y){
    let food = new Target(x,y,3);
    if(
        x > 0 &&
        y > this.height-this.vh*4-this.fontSize * 0.5 &&
        x < this.vh*4+this.textWidth &&
        y < (this.height-this.vh*4-this.fontSize * 0.5) + this.fontSize*0.5+4*this.vh
    ){
      this.addFish();
      this.var+=0.001
    }
    else{
      if(this.foods.length < this.maxFood)
        this.foods.push(food);
      else{
        this.foods[0].value=-1;
        this.foods.shift();
        this.foods.push(food);
      }
      for(let i = 0;i < this.fish.length;i++){
        this.fish[i].foodNotify(food);
      }
    }
  }
  addFish(){
    let hov = Math.random() * 2;
    let x,y,dir;
    if(hov > 1){
      y = this.height / 2;
      hov = Math.random() * 2;
      if(hov > 1){
        x = -50;
        dir = 0.0001;
      }
      else{
        x = 50 + this.width;
        dir = Math.PI;
      }
    }
    else{
      hov = Math.random() * 2;
      x=this.width / 2
      if(hov > 1){
        y = -100;
        dir = Math.PI / 2;
      }
      else{
        y = this.height + 100;
        dir = Math.PI / 2 * 3;
      }
    }
    this.fish.push(
      new Fish({
        mass:35+Math.sqrt(Math.random()*10000)+this.var,
        x:x,
        y:y,
        pond:this,
        direction:dir
      })
    );
  }
  getClosestFood(x,y){
    if(this.foods.length < 1)
      return null;
    let target = this.foods[0]
    for(let i = 1;i < this.foods.length;i++)
      if(this.foods[i].getDistance(x,y) < target.getDistance(x,y))
        target=this.foods[i];
    return target;
  }
  getSpot(){
    return this.spots[Math.floor(this.spots.length * Math.random())];
  }
  bite(x,y,radius,fish){
    for(let i = 0;i < this.foods.length;i++){
      if(this.foods[i].getDistance(x,y) < radius + 10){
        this.foods[i].eaten(fish);
        this.foods.splice(i,1);
        i--;
      }
    }
    if(fish.target && fish.target.value===0)
      for(let i = 0;i < this.spots.length;i++)
        if(this.spots[i].getDistance(x,y) < 200)
          this.spots[i].eaten(fish);
  }
}

module.exports = FishPond;