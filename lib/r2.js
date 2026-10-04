import {S3Client} from '@aws-sdk/client-s3';

export function r2Configured(){
 return !!(process.env.R2_ACCOUNT_ID&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY&&process.env.R2_BUCKET_NAME);
}

export function r2Client(){
 if(!r2Configured())throw new Error('R2 storage is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME to Vercel.');
 return new S3Client({
  region:'auto',
  endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{
   accessKeyId:process.env.R2_ACCESS_KEY_ID,
   secretAccessKey:process.env.R2_SECRET_ACCESS_KEY
  }
 });
}

export const R2_BUCKET=()=>process.env.R2_BUCKET_NAME;
