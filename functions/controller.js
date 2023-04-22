import * as THREE from "three";
import { HDRCubeTextureLoader } from "https://unpkg.com/three@0.133.0/examples/jsm/loaders/HDRCubeTextureLoader.js";
import { RGBELoader } from 'https://unpkg.com/three@0.133.0/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from "https://unpkg.com/three@0.133.0/examples/jsm/controls/OrbitControls.js";
import { USDZExporter } from "https://unpkg.com/three@0.133.0/examples/jsm/exporters/USDZExporter.js";
import { GLTFExporter } from "https://unpkg.com/three@0.133.0/examples/jsm/exporters/GLTFExporter.js";
import { Geometry } from "https://unpkg.com/three@0.133.0/examples/jsm/deprecated/Geometry.js";

import { VRButton } from "https://unpkg.com/three@0.133.0/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "https://unpkg.com/three@0.133.0/examples/jsm/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "https://unpkg.com/three@0.133.0/examples/jsm/webxr/XRHandModelFactory.js";


window.addEventListener("error", e => {
  alert("Error!\n" + e.name + ":\n" + e.message);
});

const smoothstep = (low, high, f) => {
  f = (f - low) / (high - low);
  f = Math.max(0, Math.min(1, f));
  return f * f * (3 - 2 * f);
};

class App {
  constructor() {


    this.filename = "Dummy";
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / (innerHeight), .01, 20);
    this.camera.position.set(-0.24, 1.34, 0.51);
    this.initRenderer();


    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target = new THREE.Vector3(0.02, 1.01, 0.51);

    this.scene = new THREE.Scene();
    // this.scene.add(new THREE.GridHelper(10,10));

    setTimeout(() => {
      this.initHDR();
    }, 500);

    this.initVR();

    this.pagePivot = new THREE.Object3D();
    this.scene.add(this.pagePivot);
    this.pagePivot.scale.setScalar(0.00125);
    this.pagePivot.position.y = 1.058;
    this.pagePivot.position.z = 0.46;


    this.gui = new dat.GUI();
    this.options = {
      earlyPivot: 2.1,
      latePivot: 17,
      earlyThreshold: 4.5,
      lateThreshold: 12.3,
      earlyIntensity: 8.4,
      lateIntensity: 0.83,
      bookHeight: 18,
      bookWidth: 12,
      curlPivot: 11,
      curlThreshold: 12,
      turnCurveIntensity: 1.4,

    };

    //so the lines per page at 180 was 32.
    //at 100 it was 18. 

    var curlParams = this.gui.addFolder("curl parameters");
    for (var prop in this.options) {
      curlParams.add(this.options, prop, 0, 20);
    }


    Object.assign(this.options, {
      openness: 0.2,
      linesPerPage: 32,
      turnSpeed: 0.1,
      pageCount: 119,
      autoAdvance: false,
      coverColor: "#f81004",
      typeColor: "goldenrod"
    });

    this.gui.add(this.options, "openness", 0.00, 1.0).listen();
    this.gui.add(this.options, "turnSpeed", -1, 1).listen();
    this.gui.add(this.options, "autoAdvance");



    // Fetch
    fetch("alice.txt", {
      mode: 'no-cors'
    }).then(
      result => result.text().then(t => {

        this.loadedFilename = "Alice’s Adventures in Wonderland";
        this.author = "Lewis Carroll";
        this.textNumber = "11";
        this.language = "English";
        this.releaseDate = "January, 1991";
        this.text = t.split("\n");
        this.options.pageCount = Math.ceil(this.text.length / this.options.linesPerPage / 2) * 2;
      }));

    this.gui.add(this, "loadText");

    this.options.exportModel = () => {
      window.glViewer.exportBook();
    }

    var isPhysical = true;
    this.gui.add(this.options, "exportModel");
    window.glViewer = this;


    this.buildPages(0.01);

    this.turnAmount = 0;
    this.curPage = 0;
    this.prevPage = -1;
    this.centerCurve = 0;
    this.centerTurnCurve = 0;

    const ticker = new THREE.Mesh(new THREE.PlaneGeometry(0.001, 0.001), new THREE.MeshBasicMaterial({ color: 'pink' }));
    this.scene.add(ticker);
    ticker.position.y = 1;
    ticker.position.z = 0.5;
    ticker.onBeforeRender = () => {

      if (!this.options.autoAdvance) {
        this.options.turnSpeed = this.pageTurnImpulse || 0;
      }

      this.pageTurnImpulse *= 0.95;
      this.turnAmount += (this.options.turnSpeed) / 6 * smoothstep(0.1, 0.2, this.options.openness);
      this.turnAmount = Math.max(0.0, this.turnAmount);
      this.turnAmount = Math.min(this.options.pageCount, this.turnAmount);
      this.curPage = Math.floor(this.turnAmount / 2) * 2;

      this.centerCurve = this.center.curve = 1 - this.turnAmount % 2;
      this.centerTurnCurve = this.center.turnCurve = 2 * smoothstep(1, 0.0, Math.abs(this.center.curve)) * Math.sign(-this.options.turnSpeed);

      if (this.curPage != this.prevPage) {

        requestAnimationFrame(() => {
          if (this.curPage % 1 == 0) {
            this.buildPages(this.curPage / this.options.pageCount + 0.01);
          }
          this.setPagesFrom(this.curPage, Math.sign(this.center.curve), this.left, this.center, this.right);
        });
        this.prevPage = this.curPage;
      }

      this.options.spineCurveIntensity = (this.turnAmount - this.options.pageCount / 2) / this.options.pageCount / 2 * 0.7;
      this.pagePivot.rotation.x = this.pagePivot.rotation.x * 0.9 + 0.1 * ((-this.options.spineCurveIntensity * Math.PI * 1.3) * this.options.openness + (1 - this.options.openness) * Math.PI / 2);
    }
    this.initClickPivots();

    // this.addShelf();
  }



  onPointerMove(event) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
  }

  updatePointer() {
    this.raycaster.setFromCamera(this.pointer, this.camera);


    if (this.pointerDown) {

      var intersects = this.raycaster.intersectObjects([this.bottomDragPlane], false);
      if (intersects.length > 0) {
        this.hitPoint = intersects[0].point;
        this.clickDot.position.copy(this.hitPoint);

        //let's get that angle! It's in X and Y I think.
        var angle = Math.atan2(this.hitPoint.z - 0.46, this.hitPoint.y - 1.058);
        this.clickDot.position.z = 0.14 * Math.sin(angle) + 0.46;
        this.clickDot.position.y = 0.14 * Math.cos(angle) + 1.058;
        this.dotScreen = this.clickDot.position.clone().project(this.camera);

        this.options.openness = 0.9 * this.options.openness + 0.1 * smoothstep(90, -90, angle * 57);
      }

    } else {


      var intersects = this.raycaster.intersectObjects([this.bottomClickPivot, this.left, this.right], false);
      if (intersects.length > 0) {
        var hit = intersects[0].object
        if (hit == this.bottomClickPivot) {
          this.hoverTarget = this.bottomClickPivot;

        } else if (hit == this.left) {
          this.hoverTarget = this.left;
          this.left.rightPage.emissive = new THREE.Color(1, 1, 0.5);
          this.right.leftPage.emissive = new THREE.Color(0, 0, 0);
        } else if (hit == this.right) {
          this.right.leftPage.emissive = new THREE.Color(1, 1, 0.5);
          this.left.rightPage.emissive = new THREE.Color(0, 0, 0);
          this.hoverTarget = this.right;
        }
      } else {
        this.left.rightPage.emissive = new THREE.Color(0, 0, 0);
        this.right.leftPage.emissive = new THREE.Color(0, 0, 0);
        this.hoverTarget = null;
      }
    }
  }

  onPointerDown(event) {
    if (this.hoverTarget != null) {
      if (this.hoverTarget == this.left) {
        this.pageTurnImpulse -= 0.5;
        return;
      }
      if (this.hoverTarget == this.right) {
        this.pageTurnImpulse += 0.5;
        return;
      }

      this.pointerDown = true;
      this.controls.saveState();
      this.controls.enabled = false;
    } else {
      if (!this.controls.enabled) {
        this.controls.enabled = true;
        this.controls.reset();
      }
    }
  }

  initClickPivots() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clickDot = new THREE.Mesh(new THREE.SphereGeometry(0.000003, 12, 12), new THREE.MeshBasicMaterial({ color: 'red' }));
    this.scene.add(this.clickDot);
    this.pageTurnImpulse = 0;
    this.dotScreen = new THREE.Vector3();
    document.addEventListener('pointermove', e => this.onPointerMove(e));
    document.addEventListener('pointerdown', e => this.onPointerDown(e));
    document.addEventListener('pointerup', e => {
      this.pointerDown = false;
    });
    this.hoverTarget = null;
    this.pointerDown = false;



  }

  processFile(loadEvent) {
    this.text = loadEvent.target.result.split("\n");
    this.options.linesPerPage = (this.options.bookHeight - 1) * 1.92;
    this.options.pageCount = Math.ceil(this.text.length / this.options.linesPerPage / 2) * 2;
    //let's get the title!

    this.title = null;
    this.author = null;
    this.textNumber = null;


    for (var n = 0; n < 50; n++) {
      var splitter = this.text[n].split("itle: ");
      if (splitter.length > 1) {
        this.title = splitter[1];
      }

      splitter = this.text[n].split("anguage: ");
      if (splitter.length > 1) {
        this.language = splitter[1];
      }

      splitter = this.text[n].split("uthor: ");
      if (splitter.length > 1) {
        this.author = splitter[1];
      }

      splitter = this.text[n].toLowerCase().split("elease date: ");
      if (splitter.length > 1) {
        this.releaseDate = splitter[1].split("[")[0];
      }

      splitter = this.text[n].replace(/[\[\]]/g, "").toLowerCase().split(/ebook #|etext #/);
      if (splitter.length > 1) {
        this.textNumber = splitter[splitter.length - 1];
      }

    }
    this.loadedFilename = this.title;
  }


  loadText() {
    const input = document.createElement('input');
    input.type = "file";
    var filename;
    input.addEventListener('change', changeEvent => {
      var fR = new FileReader();
      fR.addEventListener('load', loadEvent => this.processFile(loadEvent));
      // debugger;
      filename = changeEvent.target.files[0].name;
      fR.readAsText(changeEvent.target.files[0]);
    });

    input.click();



  }

  drawBorder(g, aspect) {
    var borderString = new Path2D("M121.05,116.02c0,0,0-23.72,0-41.47s0-44.96,0-44.96H34.62M93.05,86.02c0,0,93.59,0,103.98,0s91.8,0,91.8,0V30.15h259.52M0,0.5h97.36v64.66c0,0,29.26,0,41.39,0c12.12,0,35.89,0,35.89,0V0.5h566.22");
    var margin = 40;
    var scale = 0.55;

    g.save();
    g.scale(scale, scale);
    g.save();
    g.translate(margin, margin);
    g.stroke(borderString);
    g.restore();

    g.save();
    g.translate(margin, margin);
    g.rotate(Math.PI / 2);
    g.scale(1, -1);
    g.stroke(borderString);
    g.restore();


    g.save();
    g.translate(1024 / scale - margin, margin);
    g.scale(-1, 1);
    g.stroke(borderString);
    g.restore();

    g.save();
    g.translate(1024 / scale - margin, margin);
    g.rotate(-Math.PI / 2);
    g.scale(-1, -1);
    g.stroke(borderString);
    g.restore();

    g.translate(0, 1024 / scale / aspect);
    g.scale(1, -1);
    g.save();
    g.translate(margin, margin);
    g.stroke(borderString);
    g.restore();

    g.save();
    g.translate(margin, margin);
    g.rotate(Math.PI / 2);
    g.scale(1, -1);
    g.stroke(borderString);
    g.restore();


    g.save();
    g.translate(1024 / scale - margin, margin);
    g.scale(-1, 1);
    g.stroke(borderString);
    g.restore();

    g.save();
    g.translate(1024 / scale - margin, margin);
    g.rotate(-Math.PI / 2);
    g.scale(-1, -1);
    g.stroke(borderString);
    g.restore();



    g.restore();
  }

  stampLogo(g, aspect) {
    var logoP = new Path2D(document.querySelector("#logo-p").getAttribute('d'));
    g.save();

    g.font = "30px Libre Baskerville";
    g.fillText("A", 340, 55);
    g.fillText("Guide", 599, 55);
    g.font = "italic 30px Libre Baskerville";
    g.fillText("Dungeon Masters", 370, 55);
    g.font = "40px Libre Baskerville";
    var w = g.measureText("#" + this.textNumber).width;
    g.fillText("#" + this.textNumber, 512 - w / 2, 275);
    g.font = "30px Libre Baskerville";
    var w = g.measureText(this.language).width;
    g.fillText(this.language, 512 - w / 2, 1024 / aspect - 15);
    g.translate(512 - 220 / 2, 55);
    g.fill(logoP);
    g.restore();




  }
  coverPage() {

    if (window.cover == null || this.filename != this.loadedFilename) {
      this.filename = this.loadedFilename;
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      var aspect = this.options.bookWidth / this.options.bookHeight;
      const g = c.getContext('2d');

      var gold = this.options.typeColor;
      g.fillStyle = this.options.coverColor;
      g.fillRect(0, 0, 1024, 1024);

      const ormC = document.createElement('canvas');
      ormC.width = ormC.height = 1024;
      const ormG = ormC.getContext('2d');
      ormG.fillStyle = "rgb(0,80,0)";

      ormG.fillRect(0, 0, 1024, 1024);

      for (var i = 0; i < 20; i++) {
        var rx = Math.random() * 1024;
        var ry = Math.random() * 1024;
        const radialGrad = ormG.createRadialGradient(rx, ry, 0, rx, ry, 400 + Math.random() * 100);
        const rough = Math.floor(32 + Math.random() * (255 - 32));
        radialGrad.addColorStop(0, `rgba(0,${rough},0,0.25)`);
        radialGrad.addColorStop(1, `rgba(0,${rough},0,0)`);
        ormG.fillStyle = radialGrad;
        ormG.fillRect(0, 0, 1024, 1024);

      }


      const bumpC = document.createElement('canvas');
      bumpC.width = bumpC.height = 1024;
      const bumpG = bumpC.getContext('2d');
      bumpG.fillStyle = "gray";
      bumpG.fillRect(0, 0, 1024, 1024);

      g.scale(1, aspect);
      ormG.scale(1, aspect);
      bumpG.scale(1, aspect);


      g.fillStyle = gold;
      g.font = "700 80px Libre Baskerville";





      g.strokeStyle = gold;
      g.lineWidth = "8";
      g.lineJoin = "round";
      g.lineCap = "square";

      this.drawBorder(g, aspect);

      ormG.lineWidth = "8";
      ormG.lineJoin = "round";
      ormG.lineCap = "square";
      ormG.strokeStyle = "rgb(0, 30,255)";

      bumpG.lineWidth = "8";
      bumpG.lineJoin = "round";
      bumpG.lineCap = "square";
      bumpG.strokeStyle = "rgb(255, 30,255)";

      this.drawBorder(ormG, aspect);
      this.drawBorder(bumpG, aspect);

      //bottom BR eighth:
      // g.save();
      // g.scale(0.5, 0.5);
      // g.translate(1024*2-30,2*1024/aspect-30);
      // g.rotate(-Math.PI/2);
      // g.scale(-1,-1);
      // g.stroke(borderString);
      // g.restore();


      this.stampLogo(g, aspect);
      ormG.fillStyle = "rgb(0, 50,255)";
      this.stampLogo(ormG, aspect);

      bumpG.fillStyle = "white";
      this.stampLogo(bumpG, aspect);
      // draw the image onto the canvas

      var title = this.filename || "Your book title is loading ";
      var titleLines = title.split(" ").reduce((o, e) => {
        var widthWithNext = g.measureText(o[o.length - 1] + " " + e).width;
        if (widthWithNext > 900) {
          o.push(e);
        } else o[o.length - 1] = o[o.length - 1] + " " + e
        return o;
      }, [[""]]);
      // debugger;
      var w = g.measureText(title).width;





      ormG.fillStyle = "rgb(0, 50,255)";
      ormG.font = "700 80px Libre Baskerville";



      bumpG.shadowColor = "rgba(255,255,255,1)";
      bumpG.shadowBlur = 3;
      var shadowOffset = 2000;
      bumpG.shadowOffsetX = 0;
      bumpG.shadowOffsetY = shadowOffset * aspect;
      bumpG.fillStyle = "black";
      bumpG.font = "700 80px Libre Baskerville";

      titleLines.forEach((line, i, a) => {

        var w = g.measureText(line).width;
        ormG.fillText(line, 512 - w / 2, 512 / aspect + (i - a.length / 2) * 100);
        g.fillText(line, 512 - w / 2, 512 / aspect + (i - a.length / 2) * 100);
        bumpG.fillText(line, 512 - w / 2, 512 / aspect + (i - a.length / 2) * 100 - shadowOffset);
      });
      ormG.font = g.font = bumpG.font = "40px Libre Baskerville";
      var w = g.measureText(this.author || "Anonymous").width;
      ormG.fillText(this.author, 512 - w / 2, 512 / aspect + (titleLines.length / 2) * 100 - 40);
      g.fillText(this.author, 512 - w / 2, 512 / aspect + (titleLines.length / 2) * 100 - 40);

      bumpG.fillText(this.author, 512 - w / 2, 512 / aspect + (titleLines.length / 2) * 100 - 40 - shadowOffset);

      g.strokeStyle = gold;
      g.lineWidth = 5;
      ormG.strokeStyle = "rgb(0, 50,255)";
      ormG.lineWidth = 5;
      bumpG.strokeStyle = "rgba(255,255,255,1)";
      bumpG.lineWidth = 5;
      for (var i = 1; i < 4; i++) {
        //     g.strokeRect(i*20, i*20,              1024-i*40, 1024/(aspect)-i*40);
        //  ormG.strokeRect(i*20, i*20,              1024-i*40, 1024/(aspect)-i*40);
        // bumpG.strokeRect(i*20, i*20-shadowOffset, 1024-i*40, 1024/(aspect)-i*40);

      }

      const tex = canvas => {
        const t = new THREE.CanvasTexture(canvas);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.rotation = Math.PI / 2;
        return t;
      }
      window.cover = { map: tex(c), metalnessMap: tex(ormC), normalMap: tex(this.bumpToNormal(bumpC, 1, 0.5)) };
    }



    return window.cover;
  }

  buildPages(currentOffset) {
    while (this.pagePivot.children.length > 0) this.pagePivot.remove(this.pagePivot.children[0]);


    const bottomClickPivot = this.bottomClickPivot = new THREE.Mesh(new THREE.TorusGeometry(115, 5, 16, 100), new THREE.ShaderMaterial({
      fragmentShader: `

        uniform float hovered;
        uniform vec2 resolution;
        uniform vec2 pointerLocation;

        void main() {
            //let's just make a red and a blue...

            vec2 aspect = vec2(1., resolution.x/resolution.y);
          float dist = length(((pointerLocation/2. + 0.5 )- gl_FragCoord.xy/resolution.xy)/aspect);
          vec4 hoveredColor = vec4(1.0, hovered, 0.0, 1.0);
          vec4 transparent = vec4(0.,0.,0.,0.);
          gl_FragColor = mix(hoveredColor, transparent, smoothstep(0.0, 0.05, dist));
        }


        `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        hovered: { value: 0 },
        pointerLocation: { value: new THREE.Vector2() },
        resolution: { value: new THREE.Vector2() }

      }

    }));
    const bottomDragPlane = this.bottomDragPlane = new THREE.Mesh(new THREE.CircleGeometry(145, 32), new THREE.MeshBasicMaterial({ color: 'pink', side: THREE.DoubleSide }));
    bottomDragPlane.visible = false;
    // bottomClickPivot.visible = false;
    bottomDragPlane.rotation.x = Math.PI / 2;
    bottomDragPlane.rotation.y -= Math.PI / 2;
    bottomDragPlane.position.x = -90;

    this.pagePivot.add(bottomClickPivot);
    this.pagePivot.add(bottomDragPlane);
    bottomClickPivot.rotation.y = Math.PI / 2;
    bottomClickPivot.rotation.z = Math.PI / 2;
    bottomClickPivot.position.x = -90;
    bottomClickPivot.onBeforeRender = () => {

      if (this.pointerDown) {

        bottomClickPivot.material.uniforms.pointerLocation.value.copy(this.dotScreen);
      } else {
        bottomClickPivot.material.uniforms.pointerLocation.value.copy(this.pointer);

      }
      bottomClickPivot.material.uniforms.hovered.value = this.pointerDown ? 1 : 0;
      bottomClickPivot.material.uniforms.resolution.value.set(innerWidth, innerHeight).multiplyScalar(devicePixelRatio);

    };
    var currentOffset = Math.max(0.001, this.curPage / this.options.pageCount);
    var remainder = 1 - currentOffset;

    var totalWidth = this.options.pageCount / 10;
    var remainder = 1 - currentOffset;


    this.left = this.addPage(totalWidth * currentOffset, -totalWidth * currentOffset * 0.5);
    this.right = this.addPage(totalWidth * remainder, totalWidth * remainder * 0.5);
    this.center = this.addPage(0.01, 0);
    this.center.receiveShadow = false;
    const pageParts = this.coverPage();
    this.left.leftPage.map = pageParts.map;
    this.left.leftPage.metalness = this.left.leftPage.roughness = 1;
    this.left.leftPage.metalnessMap = this.left.leftPage.roughnessMap = pageParts.metalnessMap;
    this.left.leftPage.normalMap = pageParts.normalMap;

    this.left.curve = -1;
    this.right.curve = 1;
    this.center.curve = this.centerCurve;
    this.center.turnCurve = this.centerTurnCurve;
    this.left.onBeforeRender();
    this.right.onBeforeRender();
    this.center.onBeforeRender();

    this.pagePivot.add(this.left);
    this.pagePivot.add(this.right);
    this.pagePivot.add(this.center);



    this.right.position.y = this.center.position.y = this.left.position.y = 57;
    this.right.position.z = this.center.position.z = this.left.position.z = (currentOffset - 0.5) * totalWidth;
  }

  setPagesFrom(startPos, direction, left, center, right) {


    left.rightPage.map = this.pageTexture(startPos, 0);
    center.leftPage.map = this.pageTexture(startPos + 1, 1);
    center.rightPage.map = this.pageTexture(startPos + 2, 0);
    right.leftPage.map = this.pageTexture(startPos + 3, 1);


  }


  addShelf() {
    var o = {
      thickness: 0.026,
      height: 1.6,
      width: 0.92,
      depth: 0.33,
      shelfSpans: 5,
      cornerRadius: 0.0015
    };

    const normalMap = this.getWoodTexture();
    const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x100802, roughness: 1, roughnessMap: this.noiseMap(), normalMap });
    var side = new THREE.Mesh(new RoundBox(o.thickness, o.depth, o.height + o.thickness, o.cornerRadius), shelfMaterial);
    side.rotation.x = Math.PI / 2;
    var shelfPivot = new THREE.Object3D();
    shelfPivot.add(side);
    side.position.x = o.width / 2 + o.thickness / 2;
    side = side.clone();
    side.position.x *= -1;
    shelfPivot.add(side);
    var basePlank = new THREE.Mesh(new RoundBox(o.width, o.thickness, o.depth, o.cornerRadius), shelfMaterial);
    for (var i = 0; i <= o.shelfSpans; i++) {
      var plank = basePlank.clone();
      shelfPivot.add(plank);
      plank.material = plank.material.clone();
      plank.material.roughnessMap = this.noiseMap();
      plank.material.normalMap = this.getWoodTexture();
      plank.position.y = (i / o.shelfSpans - 0.5) * o.height;
    }
    shelfPivot.position.y = o.height / 2;
    this.scene.add(shelfPivot);
  }


  noiseMap() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = "gray";
    g.fillRect(0, 0, 1024, 1024);
    g.globalAlpha = 0.3;
    for (var i = 0; i < 1e4; i++) {
      g.fillStyle = `hsl(0, 100%, ${Math.floor(Math.random() * 10 + 70)}%)`;
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 100, 20);

    }

    return new THREE.CanvasTexture(c);
  }


  bumpToNormal(canvas, offset = 1, intensity = 1) {
    const g = canvas.getContext('2d');
    const src = g.getImageData(0, 0, canvas.width, canvas.height);
    const dest = g.getImageData(0, 0, canvas.width, canvas.height);


    for (var i = 0; i < src.data.length; i += 4) {

      //TODO this doens't resolve over the width boundary!
      var red = (src.data[i + 0] - src.data[i + 4 * offset]) * intensity;
      var green = (src.data[i + 0] - src.data[i + 4 * offset * canvas.width]) * intensity;
      var blue = 255 - Math.abs(red) - Math.abs(green);

      dest.data[i + 0] = 128 + red;
      dest.data[i + 1] = 128 + green;
      dest.data[i + 2] = blue;
      dest.data[i + 3] = 255;
    }

    g.putImageData(dest, 0, 0);
    return canvas;
  }




  addPage(thickness, xOffset = 0) {

    thickness = Math.max(0.01, thickness);
    const segmentHeight = 6;
    const segmentCount = 20;
    const height = segmentHeight * segmentCount;
    const halfHeight = height * 0.5;

    const sizing = {
      segmentHeight: segmentHeight,
      segmentCount: segmentCount,
      height: height,
      thickness,
      xOffset,
      halfHeight: halfHeight
    };
    const geometry = this.createGeometry(sizing);
    const bones = this.createBones(sizing);
    const mesh = this.createMesh(geometry, bones);


    mesh.curve = 0;
    mesh.turnCurve = 0;
    mesh.onBeforeRender = () => {
      var sT = Math.sin(Date.now() / 10000);
      var amt = 0.8 * sT;
      bones.forEach((b, i) => {

        var distToEarlyCurve = Math.abs(i - this.options.earlyPivot);
        var earlyCurveContribution = smoothstep(this.options.earlyThreshold, 0, distToEarlyCurve);

        var distToLateCurve = Math.abs(i - this.options.latePivot);
        var lateCurveContribution = smoothstep(this.options.lateThreshold, 0, distToLateCurve);


        var distToLateCurve = Math.abs(i - this.options.curlPivot);
        var curlCurveContribution = smoothstep(this.options.curlThreshold, 0, distToLateCurve);

        var spineCurveContribution = smoothstep(7, 1, i);

        b.rotation.x = this.options.earlyIntensity / 20 * earlyCurveContribution * mesh.curve * this.options.openness
          - this.options.lateIntensity / 20 * lateCurveContribution * mesh.curve * this.options.openness
          + this.options.turnCurveIntensity / 20 * curlCurveContribution * mesh.turnCurve * this.options.openness;
        b.rotation.y = -Math.sign(this.options.turnSpeed) * (0.15 * b.rotation.x * mesh.turnCurve * curlCurveContribution);
        b.rotation.x += this.options.spineCurveIntensity * spineCurveContribution * this.options.openness;
      });
    };
    mesh.leftPage = mesh.material[5];
    mesh.rightPage = mesh.material[4];
    return mesh;
  }

  pageTexture(pageNumber, side) {


    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');

    if (side == 1) {
      var grad = g.createLinearGradient(0, 0, 0, 60);
    } else {
      var grad = g.createLinearGradient(0, 1024, 0, 1024 - 60);
    }
    //JSON
    grad.addColorStop(0, "black");
    grad.addColorStop(1, "#C1B2A4");

    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 1024);

    //JSON
    for (var i = 0; i < 1e4; i++) {
      g.fillStyle = "#EEE6DF"; // set the fill color to brown
      g.fillRect(Math.random() * 1024, Math.random() * 1024, 23, 35); // draw a "filled" rectangle to cover the entire canvas

    }


    const fontSize = 40; // Adjust this to the desired font size

    g.translate(1024, 0);
    g.rotate(Math.PI / 2);
    g.scale(1, this.options.bookWidth / this.options.bookHeight);
    g.fillStyle = "black";
    g.font = `${fontSize}px Caveat`; // Set the font size here
    
    var leftPadder = side == 0 ? "" : new Array(120).fill(" ").join("");
    var leftGutter = side == 0 ? 30 + (fontSize * 0.2) : 80 + (fontSize * 0.2); // Adjust the gutter based on the new font size
    var lines = [leftPadder + pageNumber, ""];
    if (this.text != null)
      lines = lines.concat(this.text.slice(pageNumber * this.options.linesPerPage, (pageNumber + 2) * this.options.linesPerPage));
    lines.forEach((l, i) => {
      g.fillText(l, 40 + leftGutter, 40 * (i + 1) + (fontSize * 0.8)); // Adjust the y-position of the text based on the new font size
    });

    //  g.font = "450px Libre Baskerville";
    //  g.fillText(lines[0].split(" ")[1], 30, 900);
    const t = new THREE.CanvasTexture(c);
    if (side == 1) {
      t.rotation = Math.PI;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
    }
    return t;
  }

  bookGrid(angle = 0) {

    if (this.pagesGrid == null) {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      const g = c.getContext('2d');
      g.fillStyle = "gray";
      g.fillRect(0, 0, 1024, 1024);
      g.globalAlpha = 1;
      for (var i = 0; i < 1e2; i++) {
        g.fillStyle = `hsl(0, 10%, ${Math.floor(Math.random() * 10 + 70)}%)`;
        g.fillRect(0, Math.random() * 1024, 1024, 15);

      }
      this.pagesGrid = c;
    }
    const t = new THREE.CanvasTexture(this.pagesGrid);;
    t.rotation = angle;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t
  }

  blankTexture() {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    c.width = c.height = 4;
    g.fillStyle = this.options.coverColor;
    g.fillRect(0, 0, 4, 4);
    return new THREE.CanvasTexture(c);
  }

  createMesh(geometry, bones) {

    var bgX = new THREE.MeshStandardMaterial({ map: this.bookGrid() });
    var bgNY = new THREE.MeshStandardMaterial({ map: this.bookGrid(-Math.PI / 2) });
    var red = new THREE.MeshStandardMaterial({ color: this.options.coverColor });
    var bgY = new THREE.MeshStandardMaterial({ map: this.bookGrid(Math.PI / 2) });
    const materials = [bgNY, bgY, bgX, red];
    for (var i = 0; i < 2; i++) {
      const material = new THREE.MeshStandardMaterial({
        // color: this.options.coverColor,
        map: this.blankTexture(),
        roughness: 0.5,
        metalness: 0
      });
      materials.push(material);

    }


    const mesh = new THREE.SkinnedMesh(geometry, materials);
    const skeleton = new THREE.Skeleton(bones);

    mesh.add(bones[0]);

    mesh.bind(skeleton);

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // // const skeletonHelper = new THREE.SkeletonHelper( mesh );
    // skeletonHelper.material.linewidth = 2;

    return mesh;

  }
  createBones(sizing) {

    const bones = [];

    let prevBone = new THREE.Bone();
    bones.push(prevBone);
    prevBone.position.y = - sizing.halfHeight;

    for (let i = 0; i < sizing.segmentCount; i++) {

      const bone = new THREE.Bone();
      bone.position.y = sizing.segmentHeight;
      bones.push(bone);
      prevBone.add(bone);
      prevBone = bone;

    }

    return bones;

  }
  createGeometry(sizing) {

    const geometry = new THREE.BoxGeometry(10 * this.options.bookHeight, sizing.height, sizing.thickness, 2, sizing.segmentCount * 5);
    // const geometry = new THREE.PlaneGeometry(180,sizing.height,2,sizing.segmentCount*5);

    for (var n = 0; n < geometry.attributes.position.array.length; n += 3) {
      geometry.attributes.position.array[n + 2] += sizing.xOffset;
    }
    const position = geometry.attributes.position;

    const vertex = new THREE.Vector3();

    const skinIndices = [];
    const skinWeights = [];

    for (let i = 0; i < position.count; i++) {

      vertex.fromBufferAttribute(position, i);

      const y = (vertex.y + sizing.halfHeight);

      const skinIndex = Math.floor(y / sizing.segmentHeight);
      const skinWeight = (y % sizing.segmentHeight) / sizing.segmentHeight;

      skinIndices.push(skinIndex, skinIndex + 1, 0, 0);
      skinWeights.push(1 - skinWeight, skinWeight, 0, 0);

    }

    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    return geometry;

  }

  exportBook() {
    const exporter = new GLTFExporter();
    exporter.parse(this.scene, data => {
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const a = Object.assign(document.createElement('a'), {
        download: 'model.glb',
        href: URL.createObjectURL(blob)
      });
      // debugger;
      a.click();
    }, { binary: true });

  }
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setClearColor(0x202020);
    this.renderer.setAnimationLoop(e => this.update(e));
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.xr.enabled = true;
    Object.assign(this.renderer.domElement.style, {
      position: 'fixed',
      top: 0,
      left: 0,

    });

    this.renderer.domElement.addEventListener('dragover', e => {
      e.preventDefault();
    });
    this.renderer.domElement.addEventListener('dragenter', e => {
      e.preventDefault();

    });
    this.renderer.domElement.addEventListener('dragleave', e => {
      e.preventDefault();

    });
    this.renderer.domElement.addEventListener('drop', e => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        const fR = new FileReader();
        fR.addEventListener('load', loadEvt => this.processFile(loadEvt));
        fR.readAsText(e.dataTransfer.files[0]);
      }
    });

    document.body.appendChild(this.renderer.domElement);
  }


  initVR() {
    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory().setPath("https://threejs.org/examples/models/fbx/");

    const addControls = number => {
      const controller = this.renderer.xr.getController(number);
      this.scene.add(controller);
      const grip = this.renderer.xr.getControllerGrip(number);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.scene.add(grip);
      const hand = this.renderer.xr.getHand(number);

      hand.add(handModelFactory.createHandModel(hand));

      this.scene.add(hand);
      return { controller, grip, hand };
    };
    this.zero = addControls(0);
    this.one = addControls(1);
    this.vrButton = VRButton.createButton(this.renderer);
    document.body.appendChild(this.vrButton);
  }

  update(e) {
    this.controls.update();
    this.updatePointer();
    this.renderer.render(this.scene, this.camera);
  }

  initHDR() {
    this.renderer.physicallyCorrectLights = true;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMappingExposure = 0.3;
    this.renderer.shadowMap.enabled = true;


    const light = new THREE.DirectionalLight(0xdfebff, 1.75);
    light.position.set(0, 2, 1);

    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.camera.left = -0.13;
    light.shadow.camera.right = 0.13;
    light.shadow.camera.top = 0.2;
    light.shadow.camera.bottom = -0.2;

    light.shadow.camera.near = .8;
    light.shadow.camera.far = 1.2;
    this.scene.add(light);
    // this.scene.add( new THREE.CameraHelper( light.shadow.camera ) );

    new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .setPath('https://threejs.org/examples/textures/equirectangular/')
      .load('royal_esplanade_1k.hdr', texture => {
        //   .load( 'b515_IBL.hdr', texture=> {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        this.scene.environment = envMap;
        texture.dispose();
        pmremGenerator.dispose();
      });
  }
}

class RoundBox extends THREE.BufferGeometry {

  constructor(width = 1, height = 1, depth = 1, radius = 1, spans = 5) {

    super();
    this.root = new THREE.Object3D();

    this.width = width;
    this.height = height;
    this.depth = depth;
    this.radius = radius;
    this.spans = spans;
    var xyz = [(this.width / 2 - this.radius), (this.height / 2 - this.radius), (this.depth / 2 - this.radius)];

    var plane = this._plane(0, 1, xyz);
    plane.position.set(0, 0, this.depth / 2);

    plane = this._plane(0, 1, xyz);
    plane.position.set(0, 0, -this.depth / 2);
    plane.rotation.x = Math.PI;

    plane = this._plane(2, 1, xyz);
    plane.position.set(this.width / 2, 0, 0);
    plane.rotation.y = Math.PI / 2;

    plane = this._plane(2, 1, xyz);
    plane.position.set(-this.width / 2, 0, 0);
    plane.rotation.y = -Math.PI / 2;

    plane = this._plane(0, 2, xyz);
    plane.position.set(0, (this.height / 2), 0);
    plane.rotation.x = -Math.PI / 2;

    plane = this._plane(0, 2, xyz);
    plane.position.set(0, (-this.height / 2), 0);
    plane.rotation.x = Math.PI / 2;

    var coefsA = [[1, 0, 1], [1, 0, -1], [-1, 0, -1], [-1, 0, 1]];
    var coefsB = [[0, 1, 1], [0, 1, -1], [0, -1, -1], [0, -1, 1]];
    var coefsC = [[1, -1, 0], [1, 1, 0], [-1, 1, 0], [-1, -1, 0]];

    for (var i = 0; i < coefsA.length; i++) {
      var cyl = this._cyl(this.height, i);
      this._setPos(cyl, coefsA[i], xyz);

      cyl = this._cyl(this.width, i);
      this._setPos(cyl, coefsB[i], xyz);
      cyl.rotation.z = Math.PI / 2;

      cyl = this._cyl(this.depth, i);
      this._setPos(cyl, coefsC[i], xyz);
      cyl.rotation.x = Math.PI / 2;
    }

    coefsA = [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]];
    coefsB = [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]];
    for (var i = 0; i < coefsA.length; i++) {
      var spCorner = this._spCorner(i, 1);
      this._setPos(spCorner, coefsA[i], xyz);
      spCorner = this._spCorner(i);
      this._setPos(spCorner, coefsB[i], xyz);
    }

    let geo = new Geometry();
    this.root.traverse(e => {
      if (e.geometry) {
        e.geometry = new Geometry().fromBufferGeometry(e.geometry);
        geo.mergeMesh(e);
      }
    });
    this.copy(geo.toBufferGeometry());
  }

  _plane(xi, yi, xyz) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(2 * xyz[xi], 2 * xyz[yi]));
    this.root.add(m);
    return m;
  }

  _setPos(mesh, coefs, xyz) {
    mesh.position.set(coefs[0] * xyz[0], coefs[1] * xyz[1], coefs[2] * xyz[2]);
  }

  _spCorner(i, j) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(this.radius, this.spans, this.spans,
      i * Math.PI / 2, Math.PI / 2,
      (j || 0) * Math.PI / 2, Math.PI / 2
    ));
    this.root.add(m);
    return m;

  }

  _cyl(l, i) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(
      this.radius, this.radius, l - 2 * this.radius, this.spans,
      1, true, i * Math.PI / 2, Math.PI / 2));
    this.root.add(m);
    return m;
  };

}


document.fonts.ready.then(function () {
  window.app = new App();
});