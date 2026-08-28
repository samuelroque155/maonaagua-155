import imageCompression from 'browser-image-compression';

const IMAGE_OPTIONS = {
  maxSizeMB: 0.15,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.78
};

const THUMBNAIL_OPTIONS = {
  maxSizeMB: 0.035,
  maxWidthOrHeight: 240,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.62
};

export const compressImage = async (file) => imageCompression(file, IMAGE_OPTIONS);

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
});

export const createReportThumbnail = async (source) => {
  if (!source) return null;

  let blob = source;
  if (!(blob instanceof Blob)) {
    if (typeof source !== 'string' || !source.startsWith('data:image/')) return null;
    blob = await fetch(source).then(response => response.blob());
  }

  const imageFile = blob instanceof File
    ? blob
    : new File([blob], 'miniatura.jpg', { type: blob.type || 'image/jpeg' });
  const thumbnail = await imageCompression(imageFile, THUMBNAIL_OPTIONS);
  return fileToBase64(thumbnail);
};
