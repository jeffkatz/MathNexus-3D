
import { Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, OnDestroy, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

@Component({
  selector: 'app-graph-visualizer',
  template: `<div #canvasContainer class="w-full h-full relative cursor-move"></div>`,
  host: { class: 'block w-full h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphVisualizerComponent implements OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef<HTMLDivElement>;
  @Input() formula: string = "Math.sin(Math.sqrt(x*x + y*y))";
  @Input() color: string = "#22d3ee";
  @Input() isAnimated: boolean = true;
  @Input() timeScale: number = 1.0;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private wireframeMesh!: THREE.Mesh;
  private solidMesh!: THREE.Mesh;
  private animationFrameId?: number;
  private startTime = Date.now();
  private compiledFunc: Function | null = null;
  private resizeHandler = () => this.onWindowResize();

  ngOnChanges(changes: SimpleChanges) {
    if (this.scene) {
      if (changes['formula']) {
        this.compileFormula();
        if (!this.isAnimated) this.updateGraph(0);
      }
      if (changes['color']) {
        this.updateMaterials();
      }
    }
  }

  ngAfterViewInit() {
    this.initThree();
    this.compileFormula();
    this.createGraphMeshes();
    this.animate();
    window.addEventListener('resize', this.resizeHandler);
  }

  private compileFormula() {
    try {
      this.compiledFunc = new Function('x', 'y', 't', `try { return ${this.formula}; } catch(e) { return 0; }`);
    } catch (e) {
      this.compiledFunc = null;
    }
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);
    this.scene.fog = new THREE.Fog(0x020617, 10, 80);

    const aspect = this.canvasContainer.nativeElement.clientWidth / this.canvasContainer.nativeElement.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000);
    this.camera.position.set(15, 15, 15);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(this.canvasContainer.nativeElement.clientWidth, this.canvasContainer.nativeElement.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvasContainer.nativeElement.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;

    // Procedural Starfield
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 1000;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.5 });
    this.scene.add(new THREE.Points(starGeometry, starMaterial));

    const grid = new THREE.GridHelper(40, 40, 0x1e293b, 0x0f172a);
    this.scene.add(grid);

    this.scene.add(new THREE.AmbientLight(0x404040, 1));
    const pointLight = new THREE.PointLight(0xffffff, 2, 100);
    pointLight.position.set(10, 20, 10);
    this.scene.add(pointLight);
  }

  private createGraphMeshes() {
    const geometry = new THREE.PlaneGeometry(20, 20, 150, 150);
    geometry.rotateX(-Math.PI / 2);

    // Layer 1: Glowing Wireframe
    const wireMaterial = new THREE.MeshPhongMaterial({
      color: this.color, wireframe: true, transparent: true, opacity: 0.8,
      emissive: new THREE.Color(this.color).multiplyScalar(0.4), shininess: 100
    });
    this.wireframeMesh = new THREE.Mesh(geometry, wireMaterial);

    // Layer 2: Translucent Solid Shell
    const solidMaterial = new THREE.MeshPhongMaterial({
      color: this.color, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
      emissive: new THREE.Color(this.color).multiplyScalar(0.1), shininess: 200
    });
    this.solidMesh = new THREE.Mesh(geometry.clone(), solidMaterial);

    this.scene.add(this.wireframeMesh);
    this.scene.add(this.solidMesh);
    this.updateGraph(0);
  }

  private updateMaterials() {
    if (!this.wireframeMesh) return;
    [this.wireframeMesh, this.solidMesh].forEach((mesh, idx) => {
      const mat = mesh.material as THREE.MeshPhongMaterial;
      mat.color.set(this.color);
      mat.emissive.set(this.color).multiplyScalar(idx === 0 ? 0.4 : 0.1);
    });
  }

  private updateGraph(t: number) {
    if (!this.wireframeMesh || !this.compiledFunc) return;
    const geometries = [this.wireframeMesh.geometry, this.solidMesh.geometry];
    
    geometries.forEach(geo => {
      const vertices = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < vertices.length; i += 3) {
        const y = this.compiledFunc!(vertices[i], vertices[i + 2], t);
        vertices[i + 1] = isNaN(y) ? 0 : y;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    });
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    if (this.isAnimated) {
      const t = (Date.now() - this.startTime) / 1000 * this.timeScale;
      this.updateGraph(t);
    }
    this.renderer.render(this.scene, this.camera);
  }

  getSnapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/jpeg', 1.0);
  }

  private onWindowResize() {
    const w = this.canvasContainer.nativeElement.clientWidth;
    const h = this.canvasContainer.nativeElement.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  ngOnDestroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.resizeHandler);
  }
}
