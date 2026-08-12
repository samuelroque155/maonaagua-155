import imageCompression from 'browser-image-compression';

const IMAGE_OPTIONS = {
  maxSizeMB: 0.15,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.78
};

export const compressImage = async (file) => imageCompression(file, IMAGE_OPTIONS);

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
});
