
import { NextApiRequest, NextApiResponse } from "next";

/**
 * YouTube API レスポンスを使いやすい形式に変換する関数
 * @param {Object} youtubeResponse - YouTube API からのレスポンス
 * @returns {Object} 変換後のデータ
 */
export function transformYouTubeResponse(youtubeResponse) {
  // 必要なメタデータを抽出
  const {
    nextPageToken,
    pageInfo,
    items
  } = youtubeResponse;

  // 各動画の情報を簡略化
  const videos = items.map(item => {
    const { id, snippet } = item;
    const videoId = id.videoId;
    
    return {
      id: videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: snippet.title,
      description: snippet.description,
      thumbnail: {
        small: snippet.thumbnails.default.url,
      },
    };
  });

  // 結果を返す
  return {
    videos
  };
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: "検索クエリが必要です" });
  }

  if (!process.env.GOOGLEAPIKEY) {
    return res.status(500).json({ error: "Google APIキーが設定されていません" });
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${process.env.GOOGLEAPIKEY}&type=video&part=snippet&q=${query}`);
  const searchjson = await transformYouTubeResponse(await response.json())

  console.log(JSON.stringify(searchjson, null, 2));
  res.status(200).json(searchjson);
}
