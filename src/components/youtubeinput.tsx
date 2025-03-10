import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Search } from "lucide-react";

export default function AutoComplete() {
  const [inputValue, setInputValue] = useState("");
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  

  // 入力値が変わるたびに API リクエストを送信
  useEffect(() => {
    // 入力が空の場合は何もしない
    if (!inputValue.trim()) {
      setVideos([]);
      return;
    }

    // API リクエストを送信する関数
    const fetchVideos = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/suggestions?query=${encodeURIComponent(inputValue)}`
        );
        const data = await response.json();
        setVideos(data.videos); // videos 配列を取得
      } catch (error) {
        console.error("動画の取得に失敗しました:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // デバウンスのための遅延実行
    const timeoutId = setTimeout(() => {
      fetchVideos();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="動画を検索..."
        className="pl-8"
      />

      {/* ローディング中の表示 */}
      {isLoading && <div className="mt-1 text-sm text-gray-500">読み込み中...</div>}

      {/* 動画候補の表示 */}
      {videos.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-black border rounded shadow-md max-h-60 overflow-auto">
          {videos.map((video) => (
            <li
              key={video.id}
              className="p-2 hover:bg-gray-700 cursor-pointer text-white flex items-center"
              onClick={() => {
                setInputValue(video.title);
                setVideos([]);
              }}
            >
              <img
                src={video.thumbnail.small}
                alt={video.title}
                className="w-10 h-10 mr-2"
              />
              <div>
                <div className="font-medium">{video.title}</div>
                {video.description && (
                  <div className="text-xs text-gray-400 truncate">
                    {video.description}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
