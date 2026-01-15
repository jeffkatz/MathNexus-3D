
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";

export enum AiErrorType {
  QUOTA = 'QUOTA',
  PERMISSION = 'PERMISSION',
  UNKNOWN = 'UNKNOWN'
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  async getMathFormula(query: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Suggest a complex 3D mathematical function f(x, y, t) for a futuristic visualizer based on: "${query}". 
        CRITICAL: You MUST include the variable 't' (time) in a sophisticated way.
        Return the function as a Javascript-executable string. 
        Include a title and detailed scientific explanation.`,
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              formula: { type: Type.STRING },
              title: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ['formula', 'title', 'explanation']
          }
        }
      });
      return JSON.parse(response.text);
    } catch (error: any) {
      throw this.processError(error);
    }
  }

  async getFormulaFromImage(base64Image: string) {
    try {
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image.split(',')[1],
        },
      };
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            imagePart,
            { text: "Translate this visual geometry into a dynamic 3D math function f(x, y, t). Return JSON." }
          ]
        },
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              formula: { type: Type.STRING },
              title: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ['formula', 'title', 'explanation']
          }
        }
      });
      return JSON.parse(response.text);
    } catch (error: any) {
      throw this.processError(error);
    }
  }

  async generateMathImage(prompt: string) {
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: `Ultra-HD scientific render: ${prompt}. Cinematic lighting, 8k.`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9'
        }
      });
      return `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`;
    } catch (error: any) {
      throw this.processError(error);
    }
  }

  async generateMathVideo(prompt: string) {
    try {
      let operation = await this.ai.models.generateVideos({
        model: 'veo-2.0-generate-001',
        prompt: `Cinematic 4K fly-through: ${prompt}.`,
        config: { numberOfVideos: 1 }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        operation = await this.ai.operations.getVideosOperation({ operation: operation });
        if (operation.error) throw operation.error;
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      return `${downloadLink}&key=${process.env.API_KEY}`;
    } catch (error: any) {
      throw this.processError(error);
    }
  }

  private processError(error: any): Error {
    const errStr = JSON.stringify(error).toLowerCase();
    const message = error?.message || error?.error?.message || "Engine Link Failure";
    
    let type = AiErrorType.UNKNOWN;
    if (errStr.includes('429') || errStr.includes('quota')) type = AiErrorType.QUOTA;
    if (errStr.includes('403') || errStr.includes('permission')) type = AiErrorType.PERMISSION;

    const customError = new Error(message) as any;
    customError.type = type;
    return customError;
  }
}
