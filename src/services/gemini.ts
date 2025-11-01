
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { BrandColors, SampleProduct } from '../types';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY || "");

/**
 * Utility to convert a file to a base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URI prefix: data:image/png;base64,
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Extracts a 5-color brand palette from a logo image.
 */
export const extractBrandColors = async (base64Image: string, mimeType: string): Promise<BrandColors> => {
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const prompt = 'Analyze this logo and extract the 5 most representative brand colors. Provide them in a JSON object with keys: "primary", "secondary", "accent", "background", and "text". The primary color should be the most dominant. The background should be a suitable light color for a website, and the text color should have good contrast with the background. Provide colors in hex format.';

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();
    
    // Clean up the text to ensure it's valid JSON
    const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(jsonText);
};

/**
 * Generates logo options based on business details.
 */
export const generateLogo = async (businessName: string, category: string, favoriteColor?: string): Promise<string[]> => {
    const model = genAI.getGenerativeModel({ model: "imagen-3" }); // Using Imagen 3 for better quality

    const prompt = `Generate 2 modern, minimalist, professional logos for a business named "${businessName}" in the "${category}" category. The logos should be simple, memorable, and work well on a white background. ${favoriteColor ? `Incorporate the color ${favoriteColor}.` : ''} The output should be the logo on a transparent background.`;
    
    const result = await model.generateContent(prompt);
    // This is a simplification. The actual response structure for image generation might differ.
    // Assuming the model can return multiple images in a structured way.
    // This part might need adjustment based on the actual API response for multi-image generation.
    // For now, we will assume a text response containing base64 strings.
    const responseText = result.response.text();
    // A placeholder for parsing multiple base64 images from the response
    return [responseText];
};


/**
 * Generates sample products with AI-generated images for a given business category.
 */
export const generateSampleProducts = async (category: string): Promise<SampleProduct[]> => {
    const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageModel = genAI.getGenerativeModel({ model: "imagen-3" });

    const textPrompt = `Generate 4 sample products for an online store in the "${category}" category. For each product, provide a creative name, a price in Nigerian Naira (formatted like "₦15,000"), a simple keyword for generating an image (e.g., "leather handbag", "organic soap", "wireless earbuds"), and a compelling one-sentence description. Return the result as a valid JSON array.`;

    const generationConfig = {
      responseMimeType: "application/json",
    };

    const result = await textModel.generateContent(textPrompt, generationConfig);
    const response = result.response;
    const productInfo = JSON.parse(response.text());

    const imageGenerationPromises = productInfo.map(async (product: any) => {
        const imagePrompt = `A professional, clean e-commerce product photo of ${product.name}, a ${product.imageKeyword}, on a minimalist white background.`;
        
        // This is a simplification. The actual image generation might return a different structure.
        const imageResult = await imageModel.generateContent(imagePrompt);
        const imageResponse = imageResult.response.text(); // Assuming base64 string in text

        return {
            ...product,
            imageBase64: imageResponse,
        };
    });

    return Promise.all(imageGenerationPromises);
};
