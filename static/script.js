window.onload = () => {
  const fileInput = document.getElementById("file");
  const submitBtn = document.getElementById("button");
  const resultDiv = document.getElementById("result");

  submitBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];

    const uploader = new SplitUploader(file, 30 * 1024 ** 2, 3);
    await uploader.uploadParallel();
    await uploader.concat();
    resultDiv.textContent = "アップロード完了";
  });
};

class SplitUploader {
  maxRetries = 3;
  prefix;
  maxParallelUploads = 3;
  indexPadding = 3;
  /**
   *
   * @param {File} file アップロードするファイル
   * @param {number} chunkSize 分割するサイズ
   */
  constructor(file, chunkSize = 100 * 1024 ** 2) {
    this.file = file;
    this.chunkSize = chunkSize;

    // 分割数
    this.totalChunks = Math.ceil(file.size / chunkSize);
    // 分割数の桁数
    this.indexPadding = (this.totalChunks - 1).toString().length;
    // 現在の分割数
    this.chunkIndex = 0;
    // ファイル名のプレフィックスの取得
    this.getPrefix().then((prefix) => {
      this.prefix = prefix;
    });
  }

  async getPrefix() {
    // 拡張子の取得
    const ext = this.file.name.split(".").pop();
    if (!ext) {
      throw new Error("Failed to get extension");
    }

    // プレフィックスの取得
    const prefix = await fetch(`/upload/prefix?ext=${ext}`)
      .then((res) => {
        if (res.status === 200) {
          return res.json();
        }
        throw new Error("Failed to get prefix");
      })
      .then((data) => data.prefix);
    if (!prefix) {
      throw new Error("Failed to get prefix");
    }
    console.debug("prefix", prefix);
    return prefix;
  }

  /**
   * ファイルの結合
   */
  async concat() {
    const res = await fetch(`/upload/concat`, {
      method: "POST",
      body: JSON.stringify({
        prefix: this.prefix,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (res.status !== 200) {
      throw new Error("Failed to concat");
    }
    return res;
  }

  getNextChunk() {
    const index = this.chunkIndex;
    if (this.chunkIndex < this.totalChunks) {
      const start = index * this.chunkSize;
      const end = Math.min(start + this.chunkSize, this.file.size);
      const blob = this.file.slice(start, end);
      this.chunkIndex++;
      return [blob, index];
    }
    return [null, null];
  }

  async uploadChunk(chunk, index) {
    // prefixが取得できるまで待機
    while (!this.prefix) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const formData = new FormData();
    const filename = `${this.prefix}.part.${index
      .toString()
      .padStart(this.indexPadding, "0")}`;
    formData.append("file", chunk, filename);

    for (let i = 0; i < this.maxRetries; i++) {
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
      });
      if (res.status === 200) {
        return;
      }
    }

    throw new Error("Failed to upload chunk");
  }

  /**
   * 逐次アップロード
   */
  async upload() {
    const [chunk, index] = this.getNextChunk();
    if (chunk) {
      await this.uploadChunk(chunk, index);
      await this.upload();
    }
  }

  /**
   * 並列アップロード
   */
  async uploadParallel() {
    const chunks = [];
    for (let i = 0; i < this.maxParallelUploads; i++) {
      const [chunk, index] = this.getNextChunk();
      if (chunk) {
        chunks.push(this.uploadChunk(chunk, index));
      }
    }

    await Promise.all(chunks);

    if (this.chunkIndex < this.totalChunks) {
      await this.uploadParallel();
    }
  }
}
