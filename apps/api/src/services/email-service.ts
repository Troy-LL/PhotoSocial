import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
  ignoreTLS: true,
});

export async function sendCollageEmail(
  to: string,
  downloadUrl: string,
  scope: "full-collage" | "my-tile"
): Promise<void> {
  const subject =
    scope === "full-collage"
      ? "Your PhotoSocial collage is ready!"
      : "Your PhotoSocial photo is ready!";

  const text = `Your photo is ready to download:\n${downloadUrl}\n\nThis link expires in 72 hours.\n\nPowered by PhotoSocial`;

  const html = `
    <p>Your ${scope === "full-collage" ? "collage" : "photo"} is ready!</p>
    <p><a href="${downloadUrl}">Download your image</a></p>
    <p><small>This link expires in 72 hours.</small></p>
    <p><small>Powered by PhotoSocial</small></p>
  `;

  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
    html,
  });
}
