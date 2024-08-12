const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const sharp = require('sharp');
const os = require('os');
const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');
const cors = require('cors');
const { initializeApp } = require('firebase-admin/app');
const { getAppCheck } = require('firebase-admin/app-check');

initializeApp();

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

exports.analyzeImage = onRequest({ cors: ["https://snapself-3c339.web.app"] }, async (req, res) => {
    const appCheckToken = req.header('X-Firebase-AppCheck');
    if (!appCheckToken) {
        return res.status(401).json({ error: "Unauthorized: Missing App Check token" });
    }

    try {
        await getAppCheck().verifyToken(appCheckToken);
    } catch (error) {
        console.error("Error verifying App Check token:", error);
        return res.status(401).json({ error: "Unauthorized: Invalid App Check token" });
    }

    cors({
        origin: 'https://snapself-3c339.web.app',
        methods: ['POST'],
        credentials: true,
    })(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).end();
        }

        const busboy = Busboy({ headers: req.headers });
        let imageBuffer;
        let imageFileName;

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            if (fieldname !== 'image') {
                file.resume();
                return;
            }

            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                imageBuffer = Buffer.concat(chunks);
                imageFileName = filename;
            });
        });

        busboy.on('finish', async () => {
            if (!imageBuffer) {
                return res.status(400).json({ error: "No image file uploaded" });
            }

            try {
                const processedImageBuffer = await sharp(imageBuffer)
                    .resize(512, 512)
                    .jpeg()
                    .toBuffer();

                const tempFilePath = path.join(os.tmpdir(), `image_${Date.now()}.jpg`);
                fs.writeFileSync(tempFilePath, processedImageBuffer);

                function fileToGenerativePart(path, mimeType) {
                    return {
                        inlineData: {
                            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
                            mimeType
                        },
                    };
                }

                const filePart1 = fileToGenerativePart(tempFilePath, "image/jpeg");
                const imageParts = [filePart1];

                const prompt = `###Instruction:###
                response Score : Please provide a clear and straightforward score for the person's attractiveness on a scale from 0 to 100.
                response reason_1. facial_characteristics : Please briefly describe the basis for the score and the person’s facial and appearance characteristics.
                response reason_2. physiognomy : Briefly tell us the physiognomy of the face.
                response reason_3. first_impression: Briefly tell us your first impression of the face.
                response reason_4. suitable_partner: Please briefly tell us about a suitable boyfriend or girlfriend.
                response reason_5. MBTI : Please tell me the MBTI according to your face.

                ###Analyze the provided image and return ONLY a JSON response with the following structure:###
                                {
                                    "score": number,
                                    "reason": {
                                        "facial_characteristics": string,
                                        "physiognomy": string,
                                        "first_impression": string,
                                        "suitable_partner": string,
                                        "MBTI": string
                                    }
                                }
                ###Important:###
                - Your entire response must be a single, valid JSON object.
                - Do not include any text before or after the JSON object.
                - Ensure all string values are properly quoted.
                - Always provide a complete response with all fields, even if the image is unclear.
                
                ###Example of the ONLY acceptable response format:###
                
                Examples of correct responses:
                response: {
                  "score": 90,
                  "reason": {
                    "facial_characteristics": "This person has striking facial features, including high cheekbones and expressive eyes. Their overall appearance is very attractive.",
                    "physiognomy": "Their face shows a balance of softness and sharpness, suggesting a harmonious personality.",
                    "first_impression": "Confident and approachable.",
                    "suitable_partner": "Someone who is outgoing and supportive.",
                    "MBTI": "ENTP"
                  }
                }
                response: {
                  "score": 95,
                  "reason": {
                    "facial_characteristics": "With a chiseled jawline, piercing eyes, and well-proportioned features, this individual has an exceptionally attractive appearance.",
                    "physiognomy": "Sharp and well-defined features suggest determination and strong will.",
                    "first_impression": "Intense and captivating.",
                    "suitable_partner": "A person who is equally strong-willed and ambitious.",
                    "MBTI": "INTJ"
                  }
                }
                response: {
                  "score": 85,
                  "reason": {
                    "facial_characteristics": "The person has symmetrical features, clear skin, and a warm, genuine smile, contributing to their attractive look.",
                    "physiognomy": "Well-defined jawline and open eyes indicate a determined and open-minded nature.",
                    "first_impression": "Friendly and sincere.",
                    "suitable_partner": "A compassionate and empathetic individual.",
                    "MBTI": "ENFJ"
                  }
                }
                response: {
                  "score": 78,
                  "reason": {
                    "facial_characteristics": "Their slightly unconventional features, combined with confident posture and a unique style, create a distinctively attractive appearance.",
                    "physiognomy": "A mixture of soft and angular features suggesting creativity and independence.",
                    "first_impression": "Unique and confident.",
                    "suitable_partner": "Someone who values individuality and creativity.",
                    "MBTI": "INTP"
                  }
                }
                response: {
                  "score": 92,
                  "reason": {
                    "facial_characteristics": "High cheekbones, well-defined facial structure, and captivating eyes give this person a remarkably attractive presence.",
                    "physiognomy": "Prominent features indicate a strong character and leadership qualities.",
                    "first_impression": "Commanding and charismatic.",
                    "suitable_partner": "A supportive and understanding partner.",
                    "MBTI": "ENTJ"
                  }
                }
                response: {
                  "score": 88,
                  "reason": {
                    "facial_characteristics": "A combination of well-groomed appearance, warm smile, and harmonious facial features makes this individual notably attractive.",
                    "physiognomy": "Balanced and symmetrical features suggest a calm and stable personality.",
                    "first_impression": "Approachable and kind.",
                    "suitable_partner": "Someone who is nurturing and supportive.",
                    "MBTI": "ISFJ"
                  }
                }
                response: {
                  "score": 82,
                  "reason": {
                    "facial_characteristics": "This person has a youthful appearance, bright eyes, and balanced facial proportions, contributing to their attractive look.",
                    "physiognomy": "Bright and lively features indicate energy and enthusiasm.",
                    "first_impression": "Energetic and youthful.",
                    "suitable_partner": "A partner who is adventurous and spirited.",
                    "MBTI": "ESFP"
                  }
                }
                response: {
                  "score": 96,
                  "reason": {
                    "facial_characteristics": "Perfect facial symmetry, a radiant smile, and striking eyes make this individual exceptionally attractive.",
                    "physiognomy": "Symmetrical features suggest a harmonious and balanced nature.",
                    "first_impression": "Striking and memorable.",
                    "suitable_partner": "Someone who is equally attractive and charismatic.",
                    "MBTI": "ENFJ"
                  }
                }
                response: {
                  "score": 75,
                  "reason": {
                    "facial_characteristics": "While their features are generally pleasing, minor asymmetries slightly detract from their overall attractiveness.",
                    "physiognomy": "Minor asymmetries suggest a complex personality.",
                    "first_impression": "Interesting and unique.",
                    "suitable_partner": "Someone who appreciates uniqueness and depth.",
                    "MBTI": "INFP"
                  }
                }
                response: {
                  "score": 89,
                  "reason": {
                    "facial_characteristics": "A combination of well-defined facial features, expressive eyes, and a confident demeanor makes this person very attractive.",
                    "physiognomy": "Well-defined features indicate confidence and determination.",
                    "first_impression": "Confident and engaging.",
                    "suitable_partner": "Someone who is supportive and encouraging.",
                    "MBTI": "ENTJ"
                  }
                }
                response: {
                  "score": 80,
                  "reason": {
                    "facial_characteristics": "Classic good looks enhanced by a neat hairstyle and a genuine smile make this individual attractive.",
                    "physiognomy": "Neat and orderly features suggest discipline and reliability.",
                    "first_impression": "Neat and pleasant.",
                    "suitable_partner": "A partner who values stability and order.",
                    "MBTI": "ISTJ"
                  }
                }
                response: {
                  "score": 91,
                  "reason": {
                    "facial_characteristics": "The striking contrast between their hair color and complexion, along with strong facial features, contributes to their high attractiveness score.",
                    "physiognomy": "Contrasting features suggest a dynamic and intriguing personality.",
                    "first_impression": "Intriguing and dynamic.",
                    "suitable_partner": "Someone who appreciates depth and variety.",
                    "MBTI": "ENTP"
                  }
                }
                response: {
                  "score": 65,
                  "reason": {
                    "facial_characteristics": "Their facial features are somewhat asymmetrical, and their skin has some blemishes, which slightly detract from their overall appearance.",
                    "physiognomy": "Asymmetrical features may suggest a complex and multifaceted personality.",
                    "first_impression": "Thoughtful and reserved.",
                    "suitable_partner": "A patient and understanding individual.",
                    "MBTI": "INFJ"
                  }
                }
                response: {
                  "score": 60,
                  "reason": {
                    "facial_characteristics": "The person has less defined facial features, contributing to a more average appearance.",
                    "physiognomy": "Less defined features suggest a laid-back and easygoing personality.",
                    "first_impression": "Easygoing and approachable.",
                    "suitable_partner": "Someone who is relaxed and easygoing.",
                    "MBTI": "ISFP"
                  }
                }
                response: {
                  "score": 55,
                  "reason": {
                    "facial_characteristics": "Their facial features are plain and lack distinctiveness, giving them an ordinary look.",
                    "physiognomy": "Plain features suggest a practical and straightforward personality.",
                    "first_impression": "Practical and unassuming.",
                    "suitable_partner": "Someone who values simplicity and straightforwardness.",
                    "MBTI": "ESTJ"
                  }
                }
                response: {
                  "score": 50,
                  "reason": {
                    "facial_characteristics": "The individual has a combination of minor facial asymmetries and a lack of striking features.",
                    "physiognomy": "Minor asymmetries suggest complexity and depth.",
                    "first_impression": "Complex and interesting.",
                    "suitable_partner": "Someone who appreciates subtlety and depth.",
                    "MBTI": "INFP"
                  }
                }
                response: {
                  "score": 48,
                  "reason": {
                    "facial_characteristics": "Their facial proportions are slightly imbalanced, resulting in a less harmonious appearance.",
                    "physiognomy": "Imbalanced features suggest a unique and unconventional personality.",
                    "first_impression": "Unique and unconventional.",
                    "suitable_partner": "Someone who values individuality and uniqueness.",
                    "MBTI": "ENTP"
                  }
                }
                response: {
                  "score": 45,
                  "reason": {
                    "facial_characteristics": "The person's face lacks strong definition and distinct features, making their appearance less memorable.",
                    "physiognomy": "Lack of strong definition suggests a gentle and understated personality.",
                    "first_impression": "Gentle and understated.",
                    "suitable_partner": "Someone who is gentle and appreciates subtlety.",
                    "MBTI": "INFJ"
                  }
                }
                response: {
                  "score": 40,
                  "reason": {
                    "facial_characteristics": "Uneven skin tone and less defined facial structure affect their overall attractiveness.",
                    "physiognomy": "Uneven features suggest a multifaceted and complex personality.",
                    "first_impression": "Complex and intriguing.",
                    "suitable_partner": "Someone who appreciates complexity and depth.",
                    "MBTI": "INTJ"
                  }
                }
                response: {
                  "score": 35,
                  "reason": {
                    "facial_characteristics": "The person has several noticeable facial asymmetries and lacks standout features, leading to a lower score.",
                    "physiognomy": "Noticeable asymmetries suggest a unique and multifaceted personality.",
                    "first_impression": "Unique and intriguing.",
                    "suitable_partner": "Someone who values individuality and depth.",
                    "MBTI": "INFP"
                  }
                }
                response: {
                  "score": 30,
                  "reason": {
                    "facial_characteristics": "Their face has noticeable imperfections and lacks symmetry, significantly affecting their attractiveness.",
                    "physiognomy": "Imperfections suggest a unique and complex personality.",
                    "first_impression": "Complex and unique.",
                    "suitable_partner": "Someone who appreciates uniqueness and complexity.",
                    "MBTI": "ENTP"
                  }
                }
                response: {
                  "score": 25,
                  "reason": {
                    "facial_characteristics": "The person's facial proportions are unbalanced, and they have noticeable skin blemishes, contributing to a lower attractiveness score.",
                    "physiognomy": "Unbalanced features suggest a unique and unconventional personality.",
                    "first_impression": "Unconventional and unique.",
                    "suitable_partner": "Someone who values individuality and uniqueness.",
                    "MBTI": "INFP"
                  }
                }
               
                ###Remember:### Always return a complete JSON response, even if the image quality is poor or the face is partially obscured. Make your best assessment based on the visible features.`;

                const model = genAI.getGenerativeModel({
                    model: 'gemini-1.5-flash',
                    safetySetting: [
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_UNSPECIFIED, threshold: HarmBlockThreshold.BLOCK_NONE },
                    ],
                    generationConfig: { responseMimeType: "application/json" }
                });
                
                const result = await model.generateContent([prompt, ...imageParts]);
                const response = await result.response;
                const text = response.text();
                
                fs.unlinkSync(tempFilePath);

                res.status(200).json(JSON.parse(text));

            } catch (error) {
                console.error("Error analyzing image:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        busboy.end(req.rawBody);
    });
});

