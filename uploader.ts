import { Router } from "express";
import Multer from "multer";
import crypto from "crypto";
import fs from "fs";

const router = Router();

if (process.env.DEBUG == "true") {
  fs.readdirSync("./files")
    .filter((file) => !file.startsWith("."))
    .forEach((file) => {
      fs.unlinkSync(`./files/${file}`);
    });
}
const storage = Multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./files");
  },
  filename: (req, file, cb) => {
    cb(null, `${file.originalname}`);
  },
});
const upload = Multer({
  storage: storage,
});

const fileConcatMap = new Map<string, FileConcat>();

const uuidPattern = /[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/;
router.post("/", upload.single("file"), (req, res) => {
  const filename = req.file?.filename;
  if (filename == null) {
    res.status(400).send("Bad Request");
    return;
  }
  const prefix = filename.match(uuidPattern)?.[0];

  const fileConcat = fileConcatMap.get(prefix ?? "");
  if (fileConcat == null) {
    res.status(404).send("Not Found");
    return;
  }

  fileConcat.push(`./files/${filename}`);
  res.send("Hello");
});

const acceptFileExtensions = ["jpg", "jpeg", "png", "gif", "mp4", "avi", "mkv"];
router.get("/prefix", (req, res) => {
  const ext = req.query.ext as string | null;
  if (ext == null || !acceptFileExtensions.includes(ext)) {
    res.status(400).send("Bad Request");
    return;
  }
  const prefix = crypto.randomUUID();
  const fileConcat = new FileConcat(prefix, ext);
  fileConcatMap.set(prefix, fileConcat);
  res.send({
    prefix,
  });
});

router.post("/concat", async (req, res) => {
  const prefix = req.body.prefix as string | null;
  if (prefix == null) {
    res.status(400).send("Bad Request");
    return;
  }
  const fileConcat = fileConcatMap.get(prefix);
  if (fileConcat == null) {
    res.status(404).send("Not Found");
    return;
  }
  await fileConcat.concat(`./files/${prefix}.${fileConcat.extension}`);
  fileConcatMap.delete(prefix);
  res.send({
    status: "ok",
  });
});

// ファイルのプレフィックスを指定してファイルを結合する
class FileConcat {
  readonly prefix: string;
  readonly createdAt: Date;
  updatedAt: Date;
  readonly files: string[] = [];
  readonly extension: string;
  /**
   * 分割アップロードしたファイルを結合する
   * @param prefix ファイルのプレフィックス
   * @param extension ファイルの拡張子
   */
  constructor(prefix: string, extension: string) {
    this.prefix = prefix;
    this.extension = extension;

    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
  /**
   *
   * @param filename 追加したファイル名
   */
  push(filename: string) {
    this.updatedAt = new Date();
    this.files.push(filename);
  }

  /**
   *
   * @param filename 出力するファイル名
   */
  async concat(filename: string) {
    const writeStream = fs.createWriteStream(filename);
    for (const file of this.files.sort()) {
      try {
        await new Promise((resolve, reject) => {
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
        });
        fs.unlinkSync(file);
      } catch (e) {
        console.error(e);
        break;
      } finally {
      }
    }
    writeStream.close();
  }
}

export default router;
