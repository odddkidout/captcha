# Run this in your terminal first:
# pip install onnx onnxslim onnxruntime ultralytics

from ultralytics import YOLO

# Load the YOLO26 Nano Classification model
model = YOLO("yolo26n.pt")

# Export to ONNX format for your Node.js service
model.export(format="onnx")