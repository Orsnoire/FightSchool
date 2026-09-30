export async function uploadImageToStorage(file: File): Promise<string> {
  const response = await fetch('/api/objects/upload', {method:'POST'});
  if(!response.ok) throw new Error('Unable to prepare image upload');
  const {uploadURL,objectPath} = await response.json();
  const upload=await fetch(uploadURL,{method:'PUT',body:file,headers:{'Content-Type':file.type}});
  if(!upload.ok) throw new Error((await upload.json()).error || 'Unable to upload image');
  return objectPath;
}
