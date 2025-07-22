import { AmazonPollyVoice } from '../types';

// Helper function to create a hex-encoded SHA256 hash
async function sha256(str: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to create a HMAC-SHA256 hash
async function hmacSha256(key: ArrayBuffer, str: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    return await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(str));
}

// Function to derive the AWS Signature V4 signing key
async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
    const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
    const kRegion = await hmacSha256(kDate, regionName);
    const kService = await hmacSha256(kRegion, serviceName);
    return await hmacSha256(kService, "aws4_request");
}

async function signRequest(
    credentials: { accessKeyId: string; secretAccessKey: string; region: string },
    host: string,
    method: 'GET' | 'POST',
    path: string,
    payload: string = ''
) {
    const service = 'polly';
    const region = credentials.region;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const canonicalUri = path;
    const canonicalQuerystring = ''; // No query params for these Polly calls
    
    // Canonical headers must be sorted by character code
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    
    const payloadHash = await sha256(payload);

    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        await sha256(canonicalRequest)
    ].join('\n');

    const signingKey = await getSignatureKey(credentials.secretAccessKey, dateStamp, region, service);
    const signature = Array.from(new Uint8Array(await hmacSha256(signingKey, stringToSign)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const authorizationHeader = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        'X-Amz-Date': amzDate,
        'Authorization': authorizationHeader
    };
}


export const fetchAmazonPollyVoices = async (
    credentials: { accessKeyId: string; secretAccessKey: string; region: string },
    signal?: AbortSignal
): Promise<AmazonPollyVoice[]> => {
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        throw new Error("AWS Access Key ID and Secret Access Key are required for Amazon Polly.");
    }
    
    const host = `polly.${credentials.region}.amazonaws.com`;
    const path = '/v1/voices';
    const signedHeaders = await signRequest(credentials, host, 'GET', path);

    const response = await fetch(`https://${host}${path}`, {
        method: 'GET',
        headers: {
            ...signedHeaders
        },
        signal,
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch Amazon Polly voices: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.Voices as AmazonPollyVoice[];
};

export const generateAmazonPollySpeech = async (
    credentials: { accessKeyId: string; secretAccessKey: string; region: string },
    text: string,
    voiceId: string,
    signal?: AbortSignal
): Promise<Blob> => {
    if (!credentials.accessKeyId || !credentials.secretAccessKey) {
        throw new Error("AWS Access Key ID and Secret Access Key are required for Amazon Polly.");
    }

    const host = `polly.${credentials.region}.amazonaws.com`;
    const path = '/v1/speech';
    const payload = JSON.stringify({
        OutputFormat: 'mp3',
        Text: text,
        VoiceId: voiceId,
        Engine: 'neural' // Use neural for higher quality
    });
    
    const signedHeaders = await signRequest(credentials, host, 'POST', path, payload);

    const response = await fetch(`https://${host}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...signedHeaders
        },
        body: payload,
        signal,
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Amazon Polly TTS failed: ${response.status} ${response.statusText}`);
    }

    return response.blob();
};
