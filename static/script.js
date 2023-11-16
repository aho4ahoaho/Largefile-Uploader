window.onload = () => {
  const fileInput = document.getElementById("file");
  const submitBtn = document.getElementById("button");
  const resiltDiv = document.getElementById("result");

  submitBtn.addEventListener("click", async () => {
    console.log("clicked");
    const file = fileInput.files[0];

    const uploader = new SplitUploader(file, 100 * 1024 ** 2, 3);
    await uploader.uploadParallel();
    await uploader.concat();
  });
};

class SplitUploader {
  maxRetries = 3;
  prefix;
  maxParallelUploads = 3;
  /**
   *
   * @param {File} file アップロードするファイル
   * @param {number} chunkSize 分割するサイズ
   */
  constructor(file, chunkSize = 100 * 1024 ** 2) {
    this.file = file;
    this.chunkSize = chunkSize;
    console.log("chunkSize", chunkSize);
    this.totalChunks = Math.ceil(file.size / chunkSize);
    this.chunkIndex = 0;
    this.getPrefix().then((prefix) => {
      this.prefix = prefix;
    });
  }

  async getPrefix() {
    const ext = this.file.name.split(".").pop();
    if (!ext) {
      throw new Error("Failed to get extension");
    }
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
    return prefix;
  }

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
    console.log("Concat done");
    return res;
  }

  getNextChunk() {
    console.log("getNextChunk", this.chunkIndex, this.totalChunks);
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
    console.log("start upload chunk", index);
    const formData = new FormData();
    while (!this.prefix) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    formData.append("file", chunk, this.prefix + ".part." + index);
    console.log(this.prefix + ".part." + index);
    for (let i = 0; i < this.maxRetries; i++) {
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
      });
      if (res.status === 200) {
        console.log("Uploaded chunk", index);
        return;
      }
    }
    throw new Error("Failed to upload chunk");
  }

  async upload() {
    console.log("upload", this.chunkIndex, this.totalChunks);
    const [chunk, index] = this.getNextChunk();
    if (chunk) {
      await this.uploadChunk(chunk, index);
      await this.upload();
    }
  }

  async uploadParallel() {
    console.log(
      "uploadParallel",
      this.chunkIndex,
      this.totalChunks,
      this.maxParallelUploads
    );
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
