import * as faceapi from '@vladmandic/face-api';

let essentialModelsLoaded = false;
let recognitionModelLoaded = false;
let essentialLoadPromise: Promise<boolean> | null = null;
let recognitionLoadPromise: Promise<boolean> | null = null;

const MODEL_URL = '/models';
const getApi = () => (faceapi as any).default || faceapi;

/**
 * Phase 1: Load essential models only (~550KB total)
 * - tinyFaceDetector (~193KB) - for face detection
 * - faceLandmark68Net (~357KB) - for blink/liveness detection
 * 
 * NOTE: We do NOT import @tensorflow/tfjs separately.
 * @vladmandic/face-api bundles TF.js internally and handles initialization.
 * Importing TF.js separately would create 2 instances → kernel conflicts → very slow init.
 */
export const loadFaceApiModels = async () => {
    if (essentialModelsLoaded) return true;
    if (essentialLoadPromise) return essentialLoadPromise;

    essentialLoadPromise = (async () => {
        const api = getApi();
        const t0 = performance.now();
        try {
            console.log('[FaceAPI] ⏳ Loading essential models...');

            // Initialize TF backend using the bundled tf instance
            if (api.tf) {
                try {
                    await api.tf.setBackend('webgl');
                } catch (e) {
                    await api.tf.setBackend('cpu');
                }
                await api.tf.ready();
            }

            // face-api handles tf.ready() internally in loadFromUri()
            await Promise.all([
                api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            ]);

            essentialModelsLoaded = true;
            console.log(`[FaceAPI] ✅ Essential models loaded in ${(performance.now() - t0).toFixed(0)}ms`);


            // Start preloading recognition model in background (non-blocking)
            preloadRecognitionModel();

            return true;
        } catch (error) {
            console.error('[FaceAPI] ❌ Error loading essential models:', error);
            essentialLoadPromise = null;
            return false;
        }
    })();

    return essentialLoadPromise;
};



/**
 * Phase 2: Load heavy recognition model (~6.4MB)
 * Called lazily - either preloaded in background or on-demand before capture.
 */
const preloadRecognitionModel = () => {
    if (recognitionModelLoaded || recognitionLoadPromise) return;
    recognitionLoadPromise = loadRecognitionModel();
};

export const loadRecognitionModel = async (): Promise<boolean> => {
    if (recognitionModelLoaded) return true;
    if (recognitionLoadPromise && !recognitionModelLoaded) return recognitionLoadPromise;

    recognitionLoadPromise = (async () => {
        const api = getApi();
        try {
            await api.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
            recognitionModelLoaded = true;
            console.log('[FaceAPI] ✅ Recognition model loaded');
            return true;
        } catch (error) {
            console.error('[FaceAPI] ❌ Error loading recognition model:', error);
            recognitionLoadPromise = null;
            return false;
        }
    })();

    return recognitionLoadPromise;
};

/**
 * Ensure recognition model is ready (call before final capture)
 */
export const ensureRecognitionReady = async (): Promise<boolean> => {
    if (recognitionModelLoaded) return true;
    return loadRecognitionModel();
};


// Get consistent detector options
export const getFaceDetectorOptions = () => {
    const api = getApi();
    return new api.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5
    });
};

// Detect face and extract descriptor (ensures recognition model is loaded)
export const detectFace = async (videoOrImage: HTMLVideoElement | HTMLImageElement) => {
    // Make sure recognition model is loaded before trying to get descriptor
    await ensureRecognitionReady();

    const api = getApi();
    const options = getFaceDetectorOptions();

    const detection = await api.detectSingleFace(videoOrImage, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

    return detection;
};
