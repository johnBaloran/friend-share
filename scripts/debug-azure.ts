// scripts/debug-azure-simple.ts
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function debugAzureAPI() {
  console.log("=== Azure Face API Debug ===");
  console.log("Endpoint:", process.env.AZURE_FACE_ENDPOINT);
  console.log("API Key exists:", !!process.env.AZURE_FACE_API_KEY);
  console.log("API Key length:", process.env.AZURE_FACE_API_KEY?.length);

  if (!process.env.AZURE_FACE_ENDPOINT || !process.env.AZURE_FACE_API_KEY) {
    console.log("❌ Missing Azure credentials");
    return;
  }

  // Test with a simple public image
  const testImageUrl =
    "https://upload.wikimedia.org/wikipedia/commons/3/37/Dagestani_man_and_woman.jpg";

  try {
    const response = await fetch(
      `${process.env.AZURE_FACE_ENDPOINT}/face/v1.0/detect?returnFaceId=true`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": process.env.AZURE_FACE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: testImageUrl }),
      }
    );

    console.log("Response status:", response.status);

    if (response.ok) {
      const result = await response.json();
      console.log("✅ SUCCESS! Detected faces:", result.length);
      console.log("Face details:", result);
    } else {
      const errorText = await response.text();
      console.log("❌ ERROR Response:", errorText);
    }
  } catch (error) {
    console.log("❌ REQUEST ERROR:", error);
  }
}

debugAzureAPI();
