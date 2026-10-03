import {authorized} from '../login/route';
export async function GET(req){return Response.json({authenticated:authorized(req)})}