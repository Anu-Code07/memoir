/**
 * File Upload API Route
 *
 * Implements file uploads using Memoir Attachments API.
 * Flow: generateUploadUrl → client upload → attach → getUrl
 */

import { auth } from "@/app/(auth)/auth";
import { getMemoirAuthContext } from "@/lib/auth-memoir";
import { getMemoir, getMemoirWithAuth, getMemorySpaceId } from "@/lib/memoir";

/**
 * Determine attachment type from MIME type
 */
function getAttachmentType(
  mimeType: string
): "image" | "audio" | "video" | "pdf" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "file";
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authContext = await getMemoirAuthContext();
    const memoir = authContext ? getMemoirWithAuth(authContext) : getMemoir();
    const memorySpaceId = getMemorySpaceId();

    // Parse the form data to get the file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 1: Generate upload URL from Memoir
    const { uploadUrl } = await memoir.attachments.generateUploadUrl();

    // Step 2: Upload file to Convex storage
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });

    if (!uploadResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to upload file to storage",
          details: uploadResponse.statusText,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { storageId } = (await uploadResponse.json()) as { storageId: string };

    // Step 3: Register attachment in Memoir
    const attachment = await memoir.attachments.attach({
      storageId,
      memorySpaceId,
      userId: session.user.id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      type: getAttachmentType(file.type),
      size: file.size,
    });

    // Step 4: Get signed download URL for display
    const downloadUrl = await memoir.attachments.getUrl(attachment.attachmentId);

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate download URL" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Return response in format expected by multimodal-input component
    return Response.json({
      url: downloadUrl,
      pathname: file.name,
      contentType: file.type || "application/octet-stream",
      // Include additional metadata for consumers that need it
      id: attachment.attachmentId,
      size: file.size,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to upload file",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
