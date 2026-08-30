import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("נא להזין כתובת אימייל תקינה."),
  password: z.string().min(1, "יש להזין סיסמה."),
});

export type LoginInput = z.infer<typeof loginSchema>;
