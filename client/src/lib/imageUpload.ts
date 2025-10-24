export async function uploadImageToStorage(file: File): Promise<string> {
  const uploadResponse = await fetch('/api/objects/upload', {
    method: 'POST',
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to get upload URL');
  }

  const { uploadURL } = await uploadResponse.json();

  const putResponse = await fetch(uploadURL, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!putResponse.ok) {
    throw new Error('Failed to upload image');
  }

  const url = new URL(uploadURL);
  const objectPath = url.pathname;
  const entityId = objectPath.split('/').slice(-2).join('/');
  
  return `/objects/${entityId}`;
}
