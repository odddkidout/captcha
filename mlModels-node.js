const ort = require('onnxruntime-node');
const sharp = require('sharp');

let session = null;

async function loadYoloModel() {
    if (!session) {
        // You would export your YOLOv8 or YOLO26 model to .onnx format
        session = await ort.InferenceSession.create('./models/yolo26n.onnx');
    }
    return session;
}

async function detectInTile(tileBuffer) {
    const session = await loadYoloModel();
    
    // 1. Preprocess: Resize to YOLO input size (e.g., 640x640)
    const { data, info } = await sharp(tileBuffer)
        .resize(640, 640)
        .raw()
        .toBuffer({ resolveWithObject: true });

    // 2. Convert to Float32 Tensor
    const inputData = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        inputData[i] = data[i] / 255.0; // Normalize
    }
    
    const tensor = new ort.Tensor('float32', inputData, [1, 3, 640, 640]);
    
    // 3. Run Inference
    const outputs = await session.run({ images: tensor });
    return outputs; // Contains bounding boxes and class IDs
}