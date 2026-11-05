// Why a class action or page failed, in words for the student or teacher. Plain module: server and client use it.
const ERRORS: Record<string, string> = {
  bad_name: 'Ангийн нэр 1–60 тэмдэгт байна.',
  bad_code: 'Код 6 үсэг/тоо байна (жишээ: SUU7QK).',
  not_found: 'Ийм кодтой анги олдсонгүй.',
  own_class: 'Энэ бол таны өөрийн анги.',
  class_full: 'Анги дүүрсэн байна (200 сурагч).',
  too_many_classes: 'Нэг багш 20 хүртэл анги үүсгэнэ.',
  demo_mode: 'Анги үүсгэх, нэгдэхийн тулд нэвтэрнэ үү.',
  not_installed: 'Ангийн хэсэг одоогоор идэвхжээгүй байна (migration 0022).',
};
export const errorText = (reason: string) => ERRORS[reason] ?? 'Алдаа гарлаа. Дахин оролдоно уу.';
