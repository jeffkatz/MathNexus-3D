
import { Component, signal, inject, ChangeDetectionStrategy, ViewChild, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, AiErrorType } from './services/ai.service';
import { GraphVisualizerComponent } from './components/graph-visualizer.component';

interface Preset {
  title: string;
  formula: string;
  explanation: string;
  color: string;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, GraphVisualizerComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  private aiService = inject(AiService);

  @ViewChild(GraphVisualizerComponent) visualizer!: GraphVisualizerComponent;
  @ViewChild('videoPreview') videoPreview!: ElementRef<HTMLVideoElement>;

  // Upgraded Default Formula for "Awesome" look on load
  formula = signal("Math.sin(x + t) * Math.cos(y + t) + Math.sin(Math.sqrt(x*x + y*y) - t)");
  title = signal("Quantum Interference Grid");
  explanation = signal("A multi-dimensional wave manifold showing constructive and destructive interference patterns across a toroidal plane.");
  color = signal("#22d3ee");
  
  query = signal("");
  isLoading = signal(true); // Start with loading active for the reveal sequence
  isVideoLoading = signal(false);
  isImageLoading = signal(false);
  isCameraActive = signal(false);
  
  // Service Status
  imagenStatus = signal<'active' | 'quota' | 'error'>('active');
  veoStatus = signal<'active' | 'restricted' | 'error'>('active');
  
  videoUrl = signal<string | null>(null);
  imageUrl = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  
  sidebarOpen = signal(window.innerWidth > 768);
  isAnimated = signal(true);
  timeScale = signal(1.0);

  // ROI State
  roiX = signal(10);
  roiY = signal(10);
  roiW = signal(80);
  roiH = signal(80);

  // Stability Telemetry
  capabilities = signal<any>(null);
  exposure = signal(0);
  focus = signal(0);
  focusMode = signal('continuous');
  stabilizationActive = signal(false);
  stabilityScore = signal(100);
  gyroX = signal(0);
  gyroY = signal(0);

  private stream: MediaStream | null = null;
  private motionHandler = (event: DeviceMotionEvent) => this.updateStability(event);

  presets: Preset[] = [
    { title: "Quantum Interference", formula: "Math.sin(x + t) * Math.cos(y + t) + Math.sin(Math.sqrt(x*x + y*y) - t)", explanation: "Complex wave field.", color: "#22d3ee" },
    { title: "Gaussian Pulse", formula: "3 * Math.exp(-(x*x + y*y)/4) * Math.cos(Math.sqrt(x*x + y*y) - t)", explanation: "Localized energy.", color: "#f472b6" },
    { title: "Cosmic Loom", formula: "Math.sin(x + t) * Math.sin(y + t) + Math.cos(x - y + t)", explanation: "Intertwined filaments.", color: "#fbbf24" },
    { title: "Event Horizon", formula: "Math.sin(Math.atan2(y, x) * 5 + t) * Math.exp(-(x*x + y*y)/20)", explanation: "Vortex field.", color: "#10b981" },
    { title: "Quantum Probability", formula: "Math.sin(x*y/5 + t)", explanation: "Phase relationship.", color: "#8b5cf6" }
  ];

  ngOnInit() {
    // Dramatic reveal sequence on load
    setTimeout(() => {
      this.isLoading.set(false);
    }, 2200);
  }

  async toggleCamera() {
    this.isCameraActive() ? this.stopCamera() : await this.startCamera();
  }

  private async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } } 
      });
      this.isCameraActive.set(true);
      const track = this.stream.getVideoTracks()[0];
      if ('getCapabilities' in track) this.capabilities.set((track as any).getCapabilities());
      await this.applyCameraConstraints();
      window.addEventListener('devicemotion', this.motionHandler);
      setTimeout(() => { if (this.videoPreview) this.videoPreview.nativeElement.srcObject = this.stream; }, 0);
    } catch (err) { this.errorMessage.set("Hardware access denied."); }
  }

  private updateStability(event: DeviceMotionEvent) {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const totalMotion = Math.abs(acc.x || 0) + Math.abs(acc.y || 0) + Math.abs((acc.z || 0) - 9.8);
    this.stabilityScore.set(Math.round(Math.max(0, 100 - totalMotion * 10)));
    this.gyroX.set((acc.x || 0) * 5); this.gyroY.set((acc.y || 0) * 5);
  }

  async applyCameraConstraints() {
    if (!this.stream) return;
    const track = this.stream.getVideoTracks()[0];
    const caps = this.capabilities();
    const constraints: any = { advanced: [{}] };
    if (caps?.exposureCompensation) constraints.advanced[0].exposureCompensation = this.exposure();
    if (caps?.imageStabilizationMode) { constraints.advanced[0].imageStabilizationMode = 'best'; this.stabilizationActive.set(true); }
    try { await track.applyConstraints(constraints); } catch (e) {}
  }

  private stopCamera() {
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.isCameraActive.set(false);
    window.removeEventListener('devicemotion', this.motionHandler);
  }

  async captureAndAnalyze() {
    if (!this.videoPreview) return;
    this.isLoading.set(true);
    try {
      const video = this.videoPreview.nativeElement;
      const canvas = document.createElement('canvas');
      const sx = (this.roiX() / 100) * video.videoWidth;
      const sy = (this.roiY() / 100) * video.videoHeight;
      const sw = (this.roiW() / 100) * video.videoWidth;
      const sh = (this.roiH() / 100) * video.videoHeight;
      canvas.width = sw; canvas.height = sh;
      canvas.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      const result = await this.aiService.getFormulaFromImage(canvas.toDataURL('image/jpeg', 1.0));
      this.formula.set(result.formula); this.title.set(result.title); this.explanation.set(result.explanation);
      this.stopCamera();
    } catch (err: any) { this.errorMessage.set(err.message); } finally { this.isLoading.set(false); }
  }

  async handleSearch() {
    if (!this.query().trim()) return;
    this.isLoading.set(true);
    try {
      const result = await this.aiService.getMathFormula(this.query());
      this.formula.set(result.formula); this.title.set(result.title); this.explanation.set(result.explanation);
      this.query.set("");
    } catch (err: any) { this.errorMessage.set(err.message); } finally { this.isLoading.set(false); }
  }

  captureLocalSnapshot() {
    if (!this.visualizer) return;
    const dataUrl = this.visualizer.getSnapshot();
    this.imageUrl.set(dataUrl);
  }

  async generateAiImage() {
    this.isImageLoading.set(true);
    this.errorMessage.set(null);
    try {
      const url = await this.aiService.generateMathImage(`${this.title()}: ${this.explanation()}`);
      this.imageUrl.set(url || null);
      this.imagenStatus.set('active');
    } catch (err: any) {
      if (err.type === AiErrorType.QUOTA) {
        this.imagenStatus.set('quota');
        this.errorMessage.set("AI Quota Exhausted. Using local high-res snapshot.");
        setTimeout(() => this.captureLocalSnapshot(), 500);
      } else {
        this.errorMessage.set(err.message);
      }
    } finally { this.isImageLoading.set(false); }
  }

  async generateCinematic() {
    this.isVideoLoading.set(true);
    this.errorMessage.set(null);
    try {
      const url = await this.aiService.generateMathVideo(`${this.title()}: ${this.explanation()}`);
      this.videoUrl.set(url || null);
      this.veoStatus.set('active');
    } catch (err: any) {
      if (err.type === AiErrorType.PERMISSION) {
        this.veoStatus.set('restricted');
        this.errorMessage.set("VEO Access Restricted.");
      } else { this.errorMessage.set(err.message); }
    } finally { this.isVideoLoading.set(false); }
  }

  applyPreset(p: Preset) { this.formula.set(p.formula); this.title.set(p.title); this.explanation.set(p.explanation); this.color.set(p.color); }
  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  setColor(h: string) { this.color.set(h); }
  closeMedia() { this.videoUrl.set(null); this.imageUrl.set(null); }
  clearError() { this.errorMessage.set(null); }
  ngOnDestroy() { this.stopCamera(); }
}
