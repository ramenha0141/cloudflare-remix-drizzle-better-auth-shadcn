import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const R2 = new S3Client({
	region: 'auto',
	endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
	credentials: {
		accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
		secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
	},
});

import { generateR2Hash } from '@seller-kanrikun/calc';

// 読み込み専用ダウンロード用url取得関数
export async function getReadOnlySignedUrl(
	userId: string,
	dataName: string,
	bucket = 'seller-kanrikun',
	expiresIn = 60 * 60,
) {
	const key = await generateR2Hash(userId, dataName);

	return await getSignedUrl(
		R2,
		new GetObjectCommand({
			Bucket: bucket,
			Key: key,
		}),
		{ expiresIn },
	);
}

// 原価を書き込み専用アップロード用url取得関数
export async function getPriceWriteOnlySignedUrl(
	userId: string,
	expiresIn = 60,
) {
	const key = await generateR2Hash(userId, 'price.parquet');

	return await getSignedUrl(
		R2,
		new PutObjectCommand({
			Bucket: 'seller-kanrikun',
			Key: key,
		}),
		{ expiresIn },
	);
}
