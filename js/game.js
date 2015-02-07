$(window).load(function() {
	game.init();
});

// disable loading jquery mobile img
$(document).on("mobileinit", function() {
	jQuery.mobile.autoInitializePage = false;
});

// requestAnimationFrame and cancelAnimationFrame polyfill
(function() {
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
	}
	
	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
		
	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = function(id) { 
			clearTimeout(id); 
		};
}());

//Box2D
var b2Vec2 = Box2D.Common.Math.b2Vec2;
var b2BodyDef = Box2D.Dynamics.b2BodyDef;
var b2Body = Box2D.Dynamics.b2Body;
var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
var b2Fixture = Box2D.Dynamics.b2Fixture;
var b2World = Box2D.Dynamics.b2World;
var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;

var box2d = {
	scale: 30,
	init: function() {
		var gravity = new b2Vec2(0,9.8) //9.8m/s^2 downward
		var allowSleep = true;
		box2d.world = new b2World(gravity, allowSleep);
		
		//Set up debug draw
		// var debugContext = document.getElementById('debugcanvas').getContext('2d');
		// var debugDraw = new b2DebugDraw();
		// debugDraw.SetSprite(debugContext);
		// debugDraw.SetDrawScale(box2d.scale);
		// debugDraw.SetFillAlpha(0.3);
		// debugDraw.SetLineThickness(1.0);
		// debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
		// box2d.world.SetDebugDraw(debugDraw);
		
		var listener = new Box2D.Dynamics.b2ContactListener;
		listener.PostSolve = function(contact, impulse){
			var body1 = contact.GetFixtureA().GetBody();
			var body2 = contact.GetFixtureB().GetBody();
			var entity1 = body1.GetUserData();
			var entity2 = body2.GetUserData();
			
			var impulseAlongNormal = Math.abs(impulse.normalImpulses[0]);
			// Filter out tiny impulse to avoid overhead (event is raised very often)
			if(impulseAlongNormal > 5){
				if (entity1.health){
					entity1.health -= impulseAlongNormal;
				}
				if (entity2.health){
					entity2.health -= impulseAlongNormal;
				}
				
				if (entity1.bounceSound){
					entity1.bounceSound.play();
				}
				if (entity2.bounceSound){
					entity2.bounceSound.play();
				}
			}
		};
		box2d.world.SetContactListener(listener);
	},
	createRectangle: function(entity, definition){
		var bodyDef = new b2BodyDef;
		if (entity.isStatic){
			bodyDef.type = b2Body.b2_staticBody;
		} else {
			bodyDef.type = b2Body.b2_dynamicBody;
		}
		bodyDef.position.x = entity.x / box2d.scale;
		bodyDef.position.y = entity.y / box2d.scale;
		if (entity.angle){
			bodyDef.angle = Math.PI * entity.angle / 180;
		}
		
		var fixtureDef = new b2FixtureDef;
		fixtureDef.density = definition.density;
		fixtureDef.friction = definition.friction;
		fixtureDef.restitution = definition.restitution;
		
		fixtureDef.shape = new b2PolygonShape;
		fixtureDef.shape.SetAsBox(entity.width/2/box2d.scale, entity.height/2/box2d.scale);
	
		var body = box2d.world.CreateBody(bodyDef);
		body.SetUserData(entity);
		
		var fixture = body.CreateFixture(fixtureDef);
		return body;
	},
	createCircle: function(entity, definition){
		var bodyDef = new b2BodyDef;
		if (entity.isStatic){
			bodyDef.type = b2Body.b2_staticBody;
		} else {
			bodyDef.type = b2Body.b2_dynamicBody;
		}
		
		bodyDef.position.x = entity.x/box2d.scale;
		bodyDef.position.y = entity.y/box2d.scale;
		
		if (entity.angle) {
			bodyDef.angle = Math.PI * entity.angle/180;
		}
		var fixtureDef = new b2FixtureDef;
		fixtureDef.density = definition.density;
		fixtureDef.friction = definition.friction;
		fixtureDef.restitution = definition.restitution;
		
		fixtureDef.shape = new b2CircleShape(entity.radius/box2d.scale);
		
		var body = box2d.world.CreateBody(bodyDef);
		body.SetUserData(entity);
		body.SetAngularDamping(3.5);
		
		var fixture = body.CreateFixture(fixtureDef);
		return body;
	},
	step: function(timeStep){
		// velocity iterations = 8
		// position iterations = 3
		if (timeStep > 1/30){
			timeStep = 1/30;
		}
		box2d.world.Step(timeStep, 8, 3);
	}
}

var game = {
	init: function(){
		levels.init();
		loader.init();
		mouse.init();
		
		game.backgroundMusic = loader.loadSound('audio/gurdonark-kindergarten');
		game.slingshotReleasedSound = loader.loadSound("audio/released");
		game.bounceSound = loader.loadSound('audio/bounce');
		game.breakSound = {
			"glass": loader.loadSound('audio/glassbreak'),
			"wood": loader.loadSound('audio/woodbreak')
		};
		
		$('.gamelayer').hide();
		$('#gamestartscreen').show();
		
		game.canvas = $('#gamecanvas')[0];
		game.context = game.canvas.getContext('2d');
	},
	showLevelScreen: function(){
		game.stop();
		$('.gamelayer').hide();
		$('#levelselectscreen').show('slow');
	},
	//Game state
	mode: "intro",
	slingshotX: 140,
	slingshotY: 280,
	start: function() {
		$('.gamelayer').hide();
		//Display the game canvas and score
		$('#gamecanvas').show();
		$('#scorescreen').show();
		
		game.mode = "intro";
		game.offsetLeft = 0;
		game.ended = false;
		game.animationFrame = window.requestAnimationFrame(game.animate, game.canvas);
		
		game.startBackgroundMusic();
	},
	//Max panning speed per frame in px
	maxSpeed: 3,
	//Min/max panning offset
	minOffset: 0,
	maxOffset: 300,
	//Current panning offset
	offsetLeft: 0,
	//game score
	score: 0,
	//Pan the screen to center on newCenter
	panTo: function(newCenter) { //parallax scrolling implementation
		if (Math.abs(newCenter - game.offsetLeft - game.canvas.width/4) > 0
			&& game.offsetLeft <= game.maxOffset && game.offsetLeft >= game.minOffset) {
			var deltaX = Math.round((newCenter - game.offsetLeft - game.canvas.width/4)/2);
			if (deltaX && Math.abs(deltaX) > game.maxSpeed)
				deltaX = game.maxSpeed * Math.abs(deltaX)/deltaX;
			game.offsetLeft += deltaX;
		} else {
			return true;
		}
		if (game.offsetLeft < game.minOffset) {
			game.offsetLeft = game.minOffset;
			return true;
		} else if (game.offsetLeft > game.maxOffset) {
			game.offsetLeft = game.maxOffset;
			return true;
		}
		return false;
	},
	handlePanning: function() {
		if (game.mode == "intro") {
			if (game.panTo(700)) {
				game.mode = "load-next-hero";
			}
		}
		
		if (game.mode == "wait-for-firing") {
			if (mouse.dragging) {
				if (game.mouseOnCurrentHero()){
					game.mode = "firing";
				} else {
					game.panTo(mouse.x + game.offsetLeft);
				}
			} else {
				game.panTo(game.slingshotX);
			}
		}
				
		if(game.mode == "firing"){
			if (mouse.down){
				game.panTo(game.slingshotX);
				game.currentHero.SetPosition({x:(mouse.x+game.offsetLeft)/box2d.scale, y:mouse.y/box2d.scale});
			} else {
				game.mode = "fired";
				game.slingshotReleasedSound.play();
				var impulseScaleFactor = 0.75;
				var slingshotCenterX = game.slingshotX + 35;
				var slingshotCenterY = game.slingshotY + 25;
				var impulse = new b2Vec2((slingshotCenterX - mouse.x - game.offsetLeft) * impulseScaleFactor, (slingshotCenterY - mouse.y)*impulseScaleFactor);
				game.currentHero.ApplyImpulse(impulse, game.currentHero.GetWorldCenter());
			}
		}

		if (game.mode == "fired"){
			// Pan to wherever the hero currently is
			var heroX = game.currentHero.GetPosition().x*box2d.scale;
			game.panTo(heroX);
			// and wait till he stops moving or is out of bounds
			if (!game.currentHero.IsAwake() || heroX < 0 || heroX > game.currentLevel.foregroundImage.width){
				//then delete old hero
				box2d.world.DestroyBody(game.currentHero);
				game.currentHero = undefined;
				//and load next hero
				game.mode = "load-next-hero";
			}
		}
		
		if (game.mode == "load-next-hero"){
			game.countHeroesAndVillains();
			
			// Check if any villains are alive, if not, end the level (success)
			if (game.villains.length == 0){
				game.mode = "level-success";
				return;
			}
			
			// Check if there are any more heroes left to load, if not, end the level (failure)
			if (game.heroes.length == 0){
				game.mode = "level-failure";
				return;
			}
			
			// Load the hero and set mode to wait-for-firing
			if (!game.currentHero){
				game.currentHero = game.heroes[game.heroes.length-1];
				game.currentHero.SetPosition({x:180/box2d.scale, y:200/box2d.scale});
				game.currentHero.SetLinearVelocity({x:0, y:0});
				game.currentHero.SetAngularVelocity(0);
				game.currentHero.SetAwake(true);
			} else {
				// Wait for hero to stop bouncing and fall asleep and then switch to wait-for-firing
				game.panTo(game.slingshotX);
				if(!game.currentHero.IsAwake()){
					game.mode = "wait-for-firing";
				}
			}
		}
		
		if (game.mode == "level-success" || game.mode == "level-failure"){
			if (game.panTo(0)){
				game.ended = true;
				game.showEndingScreen();
			}
		}
	},
	countHeroesAndVillains: function(){
		game.heroes = [];
		game.villains = [];
		for (var body = box2d.world.GetBodyList(); body; body = body.GetNext()){
			var entity = body.GetUserData();
			if (entity){
				if (entity.type == "hero"){
					game.heroes.push(body);
				} else if (entity.type == "villain"){
					game.villains.push(body);
				}
			}
		}
	},
	animate: function() {
		//Animate the background
		game.handlePanning();
		
		//Animate the characters
		var currentTime = new Date().getTime();
		var timeStep;
		if (game.lastUpdateTime){
			timeStep = (currentTime - game.lastUpdateTime)/1000;
			box2d.step(timeStep);
		}
		game.lastUpdateTime = currentTime;
		
		//Draw the background with parallax scrolling
		game.context.drawImage(game.currentLevel.backgroundImage, game.offsetLeft/4, 0, 640, 480, 0, 0, 640, 480);
		game.context.drawImage(game.currentLevel.foregroundImage, game.offsetLeft, 0, 640, 480, 0, 0, 640, 480);
		
		//Draw the slingshot
		game.context.drawImage(game.slingshotImage, game.slingshotX - game.offsetLeft, game.slingshotY);
		//Draw the band when we are firing a hero
		if (game.mode == "firing"){
			game.drawSlingshotBand();
		}
		//Draw the front of the slingshot
		game.context.drawImage(game.slingshotFrontImage, game.slingshotX - game.offsetLeft, game.slingshotY);
		
		//Draw all the bodies
		game.drawAllBodies();
		
		if (!game.ended) {
			game.animationFrame = window.requestAnimationFrame(game.animate, game.canvas);
		}
	},
	drawAllBodies: function() {
		//box2d.world.DrawDebugData();
		
		//Iterate through all the bodies and draw them on the game canvas
		for (var body = box2d.world.GetBodyList(); body; body = body.GetNext()){
			var entity = body.GetUserData();
			
			if (entity){
				var entityX = body.GetPosition().x * box2d.scale;
				if (entityX < 0 || entityX > game.currentLevel.foregroundImage.width || (entity.health && entity.health < 0)){
					box2d.world.DestroyBody(body);
					if (entity.type == "villain"){
						game.score += entity.points;
						$('#score').html('Score: ' + game.score);
					}
					if (entity.breakSound){
						entity.breakSound.play();
					}
				} else {
					entities.draw(entity, body.GetPosition(), body.GetAngle());
				}
			}
		}
	},
	mouseOnCurrentHero: function(){
		if (!game.currentHero){
			return false;
		}
		var position = game.currentHero.GetPosition();
		var distanceSquared = Math.pow(position.x*box2d.scale - mouse.x-game.offsetLeft,2) + Math.pow(position.y*box2d.scale-mouse.y,2);
		var radiusSquared = Math.pow(game.currentHero.GetUserData().radius, 2);
		return (distanceSquared <= radiusSquared);
	},
	showEndingScreen: function(){
			game.stop();
			if (game.mode == "level-success"){
				$('#endingmessage').html('Mouai, pas mal');
				$('#playnextlevel').show();
				
				if (game.currentLevel.number == levels.data.length -1){ //if last lvl
					$('#playnextlevel').hide();
				}
			} else {
				$('#endingmessage').html('Tu sers a rien !!!');
				$('#playnextlevel').hide();
			}
			$('#endingscreen').show();
	},
	drawSlingshotBand: function(){
		game.context.strokeStyle = "rgb(68,31,11)"; //Darker brown
		game.context.lineWidth = 6;
	
		// Use angle hero has been dragged and radius to calculate coordinate of edge of hero wrt. hero center
		var radius = game.currentHero.GetUserData().radius;
		var heroX = game.currentHero.GetPosition().x * box2d.scale;
		var heroY = game.currentHero.GetPosition().y * box2d.scale;
		var angle = Math.atan2(game.slingshotY + 25 - heroY, game.slingshotX + 50 - heroX);
		
		var heroFarEdgeX = heroX - radius * Math.cos(angle);
		var heroFarEdgeY = heroY - radius * Math.sin(angle);
		
		game.context.beginPath();
		// Start line from top of slingshot (back side)
		game.context.moveTo(game.slingshotX+50 - game.offsetLeft, game.slingshotY + 25);
		// Draw line to center of hero
		game.context.lineTo(heroX - game.offsetLeft, heroY);
		game.context.stroke();
	
		// Draw the hero on the back band
		entities.draw(game.currentHero.GetUserData(), game.currentHero.GetPosition(), game.currentHero.GetAngle());
		game.context.beginPath();
		// Move to edge of hero farthest from slingshot top
		game.context.moveTo(heroFarEdgeX - game.offsetLeft, heroFarEdgeY);
		// Draw line back to top of slingshot (the front side)
		game.context.lineTo(game.slingshotX - game.offsetLeft + 10, game.slingshotY + 30);
		game.context.stroke();
	},
	restartLevel: function() {
		window.cancelAnimationFrame(game.animationFrame);
		game.lastUpdateTime = undefined;
		levels.load(game.currentLevel.number);
	},
	startNextLevel: function() {
		window.cancelAnimationFrame(game.animationFrame);
		game.lastUpdateTime = undefined;
		levels.load(game.currentLevel.number+1);
	},
	startBackgroundMusic: function() {
		var toggleImage = $('#togglemusic')[0];
		game.backgroundMusic.play();
		toggleImage.src = "images/icons/sound.png";
	},
	stopBackgroundMusic: function() {
		var toggleImage = $('#togglemusic')[0];
		toggleImage.src = "images/icons/nosound.png";
		game.backgroundMusic.pause();
		game.backgroundMusic.currentTime = 0; //reset sound
	},
	toggleBackgroundMusic: function() {
		var toggleImage = $('#togglemusic')[0];
		if (game.backgroundMusic.paused){
			game.backgroundMusic.play();
			toggleImage.src = "images/icons/sound.png";
		} else {
			game.backgroundMusic.pause();
			$('#togglemusic')[0].src = "images/icons/nosound.png";
		}
	},
	stop: function() { //stop anim and reset state
		if	(game.animationFrame){	
			window.cancelAnimationFrame(game.animationFrame);
			game.stopBackgroundMusic();
			game.currentHero = undefined;
		}
	}
}

var loader = {
	loaded:true,
	loadedCount:0, //Assets loaded so far
	totalCount:0, //Tot nb of assets to be loaded
	
	init: function(){
		// check for sound support
		var mp3Support,oggSupport;
		var audio = document.createElement('audio');
		if (audio.canPlayType) {
			//canPlayType() returns: '', 'maybe' or 'probably'
			mp3Support="" != audio.canPlayType('audio/mpeg');
			oggSupport="" != audio.canPlayType('audio/ogg; codes="vorbis"');
		}
		else {
			//audio tag not supported
			mp3Support = false;
			oggSupport = false;
		}
		
		// Check for ogg, then mp3, and finally set soundFileExtn to undefined
		loader.soundFileExtn=oggSupport?".ogg":mp3Support?".mp3":undefined;
	},
	
	loadImage: function(url){
		this.totalCount++;
		this.loaded = false;
		$('#loadingscreen').show();
		var image = new Image();
		image.src = url;
		image.onload = loader.itemLoaded;
		return image;
	},
	
	soundFileExtn: ".ogg",
	
	loadSound: function(url){
		this.totalCount++;
		this.loaded = false;
		$('#loadingscreen').show();
		var audio = new Audio();
		audio.src = url + loader.soundFileExtn;
		audio.addEventListener('canplaythrough', loader.itemLoaded, false);
		return audio;
	},
	
	itemLoaded: function(){
		loader.loadedCount++;
		$('#loadingmessage').html('Loaded ' + loader.loadedCount + ' of ' + loader.totalCount);
		if (loader.loadedCount >= loader.totalCount){ // > for bug fix (b/c timing issue ?)
			loader.loaded = true;
			$('#loadingscreen').hide();
			//reset
			loader.loadedCount = 0;
			loader.totalCount = 0;
			if (loader.onload){
				loader.onload();
				loader.onload = undefined;
			}
		}
	}
}

var mouse = {
	x: 0,
	y: 0,
	down: false,
	init: function() {
		//real mouse
		$('#gamecanvas').mousemove(mouse.mousemovehandler);
		$('#gamecanvas').mousedown(mouse.mousedownhandler);
		$('#gamecanvas').mouseup(mouse.mouseuphandler);
		$('#gamecanvas').mouseout(mouse.mouseuphandler);
		//jquery mobile for tactile
		$('#gamecanvas').on('vmousemove', mouse.mousemovehandler);
		$('#gamecanvas').on('vmousedown', mouse.mousedownhandler);
		$('#gamecanvas').on('vmouseup', mouse.mouseuphandler);
		$('#gamecanvas').on('vmouseout', mouse.mouseuphandler);
	},
	mousemovehandler: function(ev) {
		var offset = $('#gamecanvas').offset();
		mouse.x = ev.pageX - offset.left;
		mouse.y = ev.pageY - offset.top;
		if (mouse.down) 
			mouse.dragging = true;
	},
	mousedownhandler: function(ev) {
		mouse.down = true;
		mouse.downX = mouse.x;
		mouse.downY = mouse.y;
		ev.originalEvent.preventDefault();
	},
	mouseuphandler: function(ev) {
		mouse.down = false;
		mouse.dragging = false;
	}
}

var entities = {
	definitions: {
		"glass": {
			fullHealth:150,
			density:2.4,
			friction:0.4,
			restitution:0.15
		},
		"wood": {
			fullHealth:750,
			density:0.7,
			friction:0.7,
			restitution:0.4
		},
		"dirt": {
			density:3.0,
			friction:1.5,
			restitution:0.2
		},
		"angry_roux": {
			shape:"circle",
			radius:30,
			density:0.6,
			friction:0.5,
			restitution:0.5
		},
		"poney1": {
			shape:"rectangle",
			fullHealth:100,
			width:70,
			height:60,
			density:0.85,
			friction:0.5,
			restitution:0.6
		},
		"poney2": {
			shape:"rectangle",
			fullHealth:100,
			width:81,
			height:50,
			density:0.85,
			friction:0.5,
			restitution:0.6
		},
		"poney3": {
			shape:"rectangle",
			fullHealth:100,
			width:56,
			height:70,
			density:0.85,
			friction:0.5,
			restitution:0.6
		}
	},
	// create a Box2D body and add to world
	create: function(entity) {
		var definition = entities.definitions[entity.name];
		if (!definition){
			console.log("Undefined entity name", entity.name);
			return;
		}
		switch(entity.type){
			case "block": //simple rectangles
				entity.health = definition.fullHealth;
				entity.fullHealth = definition.fullHealth;
				entity.shape = "rectangle";
				entity.sprite = loader.loadImage("images/entities/" + entity.name + ".png");
				entity.breakSound = game.breakSound[entity.name];
				box2d.createRectangle(entity, definition);
				break;
			case "ground": //simple rectangles
				// No need for health, indestructible
				entity.shape = "rectangle";
				// No need for sprites, won't be drawn
				box2d.createRectangle(entity, definition);
				break;
			case "hero": // simple circles
			case "villain": // can be circles or rectangles
				entity.health = definition.fullHealth;
				entity.fullHealth = definition.fullHealth;
				entity.sprite = loader.loadImage("images/entities/" + entity.name + ".png");
				entity.shape = definition.shape;
				entity.bounceSound = game.bounceSound;
				if (definition.shape == "circle"){
					entity.radius = definition.radius;
					box2d.createCircle(entity, definition);
				} else if (definition.shape == "rectangle") {
					entity.width = definition.width;
					entity.height = definition.height;
					box2d.createRectangle(entity, definition);
				}
				break;
			default:
				console.log("Undefined entity type", entity.type);
				break;
		}
	},
	draw: function(entity, position, angle) {
		game.context.translate(position.x*box2d.scale-game.offsetLeft, position.y*box2d.scale);
		game.context.rotate(angle);
		switch (entity.type){
			case "block":
				game.context.drawImage(entity.sprite, 0, 0, entity.sprite.width, entity.sprite.height, -entity.width/2-1, -entity.height/2-1, entity.width+2, entity.height+2);
				break;
			case "villain":
			case "hero":
				if (entity.shape=="circle"){
					game.context.drawImage(entity.sprite, 0, 0, entity.sprite.width, entity.sprite.height, -entity.radius-1, -entity.radius-1, entity.radius*2+2, entity.radius*2+2);
				} else if (entity.shape == "rectangle"){
					game.context.drawImage(entity.sprite, 0, 0, entity.sprite.width, entity.sprite.height, -entity.width/2-1, -entity.height/2-1, entity.width+2, entity.height+2);
				}
				break;
			case "ground":
				// ground and slingshot are drawn separately
				break;
		}
		game.context.rotate(-angle);
		game.context.translate(-position.x*box2d.scale+game.offsetLeft, -position.y*box2d.scale);
	}
}

var levels = {
	data:[
		{ 	// 1st lvl
			foreground: 'desert-foreground',
			background: 'clouds-background',
			entities: [
				{type:"ground", name:"dirt", x:500, y:440, width:1000, height:20, isStatic:true},
				{type:"ground", name:"wood", x:180, y:390, width:40, height:80, isStatic:true},
				
				{type:"block", name:"wood", x:520, y:375, angle:90, width:100, height:25},
				{type:"block", name:"glass", x:520, y:275, angle:90, width:100, height:25},
				{type:"villain", name:"poney3", x:520, y:200, points:590},
				
				{type:"block", name:"wood", x:620, y:375, angle:90, width:100, height:25},
				{type:"block", name:"glass", x:620, y:275, angle:90, width:100, height:25},
				{type:"villain", name:"poney1", x:620, y:200, points:420},
				
				{type:"hero", name:"angry_roux", x:90, y:410},
				{type:"hero", name:"angry_roux", x:170, y:410}
			]
		},
		{ 	// 2nd lvl
			foreground: 'desert-foreground',
			background: 'clouds-background',
			entities: [
				{type:"ground", name:"dirt", x:500, y:425, width:1000, height:20, isStatic:true},
				{type:"ground", name:"wood", x:180, y:390, width:30, height:80, isStatic:true},
				{type:"block", name:"wood", x:815, y:380, angle:90, width:100, height:25},
				{type:"block", name:"wood", x:720, y:380, angle:90, width:100, height:25},
				{type:"block", name:"wood", x:625, y:380, angle:90, width:100, height:25},
				{type:"block", name:"glass", x:670, y:280, width:100, height:25},
				{type:"block", name:"glass", x:770, y:280, width:100, height:25},
				
				{type:"block", name:"glass", x:670, y:255, angle:90, width:100, height:25},
				{type:"block", name:"glass", x:770, y:255, angle:90, width:100, height:25},
				{type:"block", name:"wood", x:720, y:155, width:100, height:25},
				
				{type:"villain", name:"poney1", x:720, y:260, points:590},
				{type:"villain", name:"poney2", x:670, y:405, points:420},
				{type:"villain", name:"poney3", x:765, y:395, points:150},

				{type:"hero", name:"angry_roux", x:80, y:415},
				{type:"hero", name:"angry_roux", x:120, y:405},
				{type:"hero", name:"angry_roux", x:200, y:402}
			]
		},
		{ 	//3rd lvl
			foreground: 'desert-foreground',
			background: 'clouds-background',
			entities: [
				{type:"ground", name:"dirt", x:500, y:425, width:1000, height:20, isStatic:true},
				{type:"ground", name:"wood", x:180, y:390, width:30, height:80, isStatic:true},
				
				{type:"villain", name:"poney1", x:405, y:390, points:500},
				
				{type:"block", name:"wood", x:435, y:380, angle:90, width:100, height:25},
				{type:"block", name:"wood", x:600, y:380, angle:90, width:100, height:25},
				{type:"block", name:"glass", x:600, y:280, angle:90, width:100, height:25},
				{type:"block", name:"wood", x:625, y:380, angle:90, width:100, height:25},
				{type:"block", name:"wood", x:715, y:380, angle:90, width:100, height:25},
				{type:"block", name:"glass", x:665, y:280, width:100, height:25},
				{type:"block", name:"glass", x:665, y:255, width:100, height:25},
				{type:"villain", name:"poney3", x:665, y:230, points:750},
				{type:"villain", name:"poney2", x:655, y:380, points:1000},
				{type:"block", name:"wood", x:740, y:380, angle:90, width:100, height:25},
				{type:"block", name:"glass", x:733, y:280, angle:90, width:100, height:25},
				
				{type:"hero", name:"angry_roux", x:80, y:415},
				{type:"hero", name:"angry_roux", x:120, y:405},
				{type:"hero", name:"angry_roux", x:200, y:402}
			]
		},
		{ 	//4th lvl
			foreground: 'desert-foreground',
			background: 'clouds-background',
			entities: [
				{type:"ground", name:"dirt", x:500, y:425, width:1000, height:20, isStatic:true},
				{type:"ground", name:"wood", x:180, y:390, width:30, height:80, isStatic:true},
				
				{type:"block", name:"wood", x:500, y:380, width:100, height:25},
				{type:"block", name:"wood", x:500, y:355, width:100, height:25},
				{type:"block", name:"wood", x:500, y:330, width:100, height:25},
				{type:"block", name:"wood", x:500, y:305, width:100, height:25},
				{type:"block", name:"wood", x:500, y:280, width:100, height:25},
				{type:"block", name:"wood", x:500, y:255, width:100, height:25},
				{type:"block", name:"wood", x:500, y:230, width:100, height:25},
				{type:"block", name:"wood", x:500, y:205, width:100, height:25},
				{type:"block", name:"wood", x:500, y:180, width:100, height:25},
				{type:"villain", name:"poney2", x:505, y:155, points:350},
				{type:"villain", name:"poney3", x:605, y:380, points:500},
				{type:"block", name:"wood", x:700, y:380, width:100, height:25},
				{type:"block", name:"wood", x:700, y:355, width:100, height:25},
				{type:"block", name:"wood", x:700, y:330, width:100, height:25},
				{type:"villain", name:"poney1", x:705, y:305, points:500},
				
				{type:"hero", name:"angry_roux", x:80, y:415},
				{type:"hero", name:"angry_roux", x:120, y:405},
				{type:"hero", name:"angry_roux", x:200, y:402}
			]
		}
	],
	
	//Init lvl selection screen
	init: function(){
		var html="";
		for (var i=0; i<levels.data.length; i++) {
			var level = levels.data[i];
			html+= '<input type="button" value="'+(i+1)+'">';
		};
		$('#levelselectscreen').html(html);
		$('#levelselectscreen input').click(function(){
			levels.load(this.value-1);
			$('#levelselectscreen').hide();
		});
	},
	
	// Load lvl assets
	load: function(number){
		box2d.init();
	
		// new currentLevel obj
		game.currentLevel = { number:number, hero:[] };
		game.score = 0;
		$('#score').html('Score: '+game.score);
		var level = levels.data[number];
		
		game.currentLevel.backgroundImage = loader.loadImage("images/backgrounds/"+level.background+".png");
		game.currentLevel.foregroundImage = loader.loadImage("images/backgrounds/"+level.foreground+".png");
		game.slingshotImage = loader.loadImage("images/slingshot.png");
		game.slingshotFrontImage = loader.loadImage("images/slingshot-front.png");
		
		//load entities
		for (var i = level.entities.length - 1; i >= 0; i--) {
			var entity = level.entities[i];
			entities.create(entity);
		}
		
		if(loader.loaded){
			game.start();
		}
		else {
			loader.onload = game.start;
		}
	}
}
