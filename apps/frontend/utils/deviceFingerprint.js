/**
 * Device Fingerprinting Utility
 * Generates unique hardware-based fingerprint for anti-sharing detection
 */

class DeviceFingerprinter {
  constructor() {
    this.fingerprint = null;
    this.deviceInfo = null;
  }

  /**
   * Generate complete device fingerprint
   */
  async generateFingerprint() {
    try {
      const components = await Promise.all([
        this.getGPUInfo(),
        this.getCPUInfo(),
        this.getMemoryInfo(),
        this.getScreenInfo(),
        this.getCanvasFingerprint(),
        this.getWebGLFingerprint(),
        this.getAudioFingerprint(),
        this.getFontFingerprint(),
        this.getBrowserInfo(),
        this.getSystemInfo()
      ]);

      const deviceInfo = {
        gpu: components[0],
        cpu: components[1],
        memory: components[2],
        screen: components[3],
        canvasFingerprint: components[4],
        webglFingerprint: components[5],
        audioFingerprint: components[6],
        fontFingerprint: components[7],
        browser: components[8],
        system: components[9],
        timestamp: Date.now()
      };

      // Create hash from all components
      const fingerprintString = JSON.stringify(deviceInfo);
      const fingerprint = await this.hashString(fingerprintString);

      this.deviceInfo = deviceInfo;
      this.fingerprint = fingerprint;

      return {
        fingerprint,
        deviceInfo,
        confidence: this.calculateConfidence(deviceInfo)
      };
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      return this.getFallbackFingerprint();
    }
  }

  /**
   * Get GPU information via WebGL
   */
  async getGPUInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'webgl-not-supported';

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return `${vendor} ${renderer}`.substring(0, 200);
      }

      return gl.getParameter(gl.RENDERER) || 'unknown-gpu';
    } catch (error) {
      return 'gpu-error';
    }
  }

  /**
   * Get CPU information
   */
  getCPUInfo() {
    return {
      cores: navigator.hardwareConcurrency || 0,
      architecture: navigator.platform || '',
      concurrency: navigator.hardwareConcurrency || 0
    };
  }

  /**
   * Get memory information
   */
  getMemoryInfo() {
    return {
      deviceMemory: navigator.deviceMemory || 0,
      maxTouchPoints: navigator.maxTouchPoints || 0
    };
  }

  /**
   * Get screen information
   */
  getScreenInfo() {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation?.type || '',
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  /**
   * Generate Canvas fingerprint
   */
  getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 200;
      canvas.height = 50;

      // Draw complex pattern
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Device fingerprint 🔒', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.2)';
      ctx.fillText('Fingerprint test', 4, 30);

      // Add some curves and shapes
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.beginPath();
      ctx.arc(50, 25, 20, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();

      return canvas.toDataURL().substring(0, 100);
    } catch (error) {
      return 'canvas-error';
    }
  }

  /**
   * Generate WebGL fingerprint
   */
  getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      
      if (!gl) return 'no-webgl';

      // Get WebGL parameters
      const params = [
        'VERSION', 'SHADING_LANGUAGE_VERSION', 'VENDOR', 'RENDERER',
        'MAX_VERTEX_ATTRIBS', 'MAX_VERTEX_UNIFORM_VECTORS',
        'MAX_FRAGMENT_UNIFORM_VECTORS', 'MAX_VARYING_VECTORS'
      ];

      const info = params.map(param => {
        try {
          return gl.getParameter(gl[param]);
        } catch (e) {
          return null;
        }
      }).join('|');

      return btoa(info).substring(0, 100);
    } catch (error) {
      return 'webgl-error';
    }
  }

  /**
   * Generate Audio fingerprint
   */
  async getAudioFingerprint() {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) {
        return 'no-audio-context';
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioCtx();
      
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gain = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

      gain.gain.value = 0;
      oscillator.type = 'triangle';
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(0);

      const fingerprint = `${audioContext.sampleRate}-${audioContext.maxChannelCount}`;
      
      audioContext.close();
      return fingerprint;
    } catch (error) {
      return 'audio-error';
    }
  }

  /**
   * Detect installed fonts
   */
  getFontFingerprint() {
    try {
      const testFonts = [
        'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold',
        'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New',
        'Georgia', 'Helvetica', 'Impact', 'Lucida Console', 'Palatino',
        'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana'
      ];

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const testString = 'mmmmmmmmmmlli';
      const defaultWidth = {};
      const defaultHeight = {};

      // Get default measurements
      for (const font of testFonts) {
        ctx.font = `72px ${font}, monospace`;
        const metrics = ctx.measureText(testString);
        defaultWidth[font] = metrics.width;
        defaultHeight[font] = metrics.actualBoundingBoxHeight || 0;
      }

      const availableFonts = testFonts.filter(font => {
        ctx.font = `72px ${font}, monospace`;
        const metrics = ctx.measureText(testString);
        return metrics.width !== defaultWidth['monospace'] ||
               (metrics.actualBoundingBoxHeight || 0) !== defaultHeight['monospace'];
      });

      return availableFonts.sort().join(',').substring(0, 100);
    } catch (error) {
      return 'font-error';
    }
  }

  /**
   * Get browser information
   */
  getBrowserInfo() {
    return {
      userAgent: navigator.userAgent.substring(0, 200),
      language: navigator.language,
      languages: navigator.languages?.join(',').substring(0, 100) || '',
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      onLine: navigator.onLine,
      platform: navigator.platform,
      javaEnabled: typeof navigator.javaEnabled === 'function' ? navigator.javaEnabled() : false
    };
  }

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage,
      indexedDB: !!window.indexedDB,
      webWorker: !!window.Worker,
      webSocket: !!window.WebSocket
    };
  }

  /**
   * Hash string using SubtleCrypto API
   */
  async hashString(str) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback to simple hash
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash).toString(16);
    }
  }

  /**
   * Calculate confidence score for fingerprint
   */
  calculateConfidence(deviceInfo) {
    let score = 0;
    
    if (deviceInfo.gpu && deviceInfo.gpu !== 'unknown-gpu') score += 25;
    if (deviceInfo.cpu.cores > 0) score += 15;
    if (deviceInfo.memory.deviceMemory > 0) score += 10;
    if (deviceInfo.canvasFingerprint && deviceInfo.canvasFingerprint !== 'canvas-error') score += 20;
    if (deviceInfo.webglFingerprint && deviceInfo.webglFingerprint !== 'no-webgl') score += 15;
    if (deviceInfo.audioFingerprint && deviceInfo.audioFingerprint !== 'no-audio-context') score += 10;
    if (deviceInfo.fontFingerprint && deviceInfo.fontFingerprint.length > 10) score += 5;

    return Math.min(100, score);
  }

  /**
   * Fallback fingerprint when main method fails
   */
  getFallbackFingerprint() {
    const fallbackData = {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      timezone: new Date().getTimezoneOffset(),
      language: navigator.language,
      platform: navigator.platform,
      timestamp: Date.now()
    };

    const fallbackString = JSON.stringify(fallbackData);
    let hash = 0;
    for (let i = 0; i < fallbackString.length; i++) {
      const char = fallbackString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return {
      fingerprint: Math.abs(hash).toString(16),
      deviceInfo: fallbackData,
      confidence: 30,
      fallback: true
    };
  }

  /**
   * Get cached fingerprint or generate new one
   */
  async getFingerprint() {
    if (!this.fingerprint) {
      await this.generateFingerprint();
    }
    return {
      fingerprint: this.fingerprint,
      deviceInfo: this.deviceInfo
    };
  }
}

// Export singleton instance
export const deviceFingerprinter = new DeviceFingerprinter();
export default deviceFingerprinter;