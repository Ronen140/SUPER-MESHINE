import { z } from "zod";

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "השם קצר מדי — נדרשים לפחות 2 תווים."),
    email: z.email("נא להזין כתובת אימייל תקינה."),
    password: z.string().min(6, "הסיסמה קצרה מדי — נדרשים לפחות 6 תווים."),
    confirmPassword: z.string().min(1, "יש לאמת את הסיסמה."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
