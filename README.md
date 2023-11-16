# largefile-uploader

大きなファイルをアップロードするテストのプロジェクト

# 実行

```bash
bun install
bun start
```

# 注意点

以下の様な記述があるが、これは Bun の`ReadStream`には pipe のバグがあるため回避しているためで、
本来は`readStream.pipe(writeStream,{end:false})`だけでコピー出来るはず。

```JavaScript
const readStream = fs.createReadStream(file);
if (!readStream.readable) {
    reject("Not Readable");
}
readStream.on("data", (chunk) => {
    writeStream.write(chunk);
});
readStream.on("end", () => {
    resolve(null);
});
```
