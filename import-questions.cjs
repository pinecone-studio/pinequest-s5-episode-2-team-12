const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = '';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || 'YOUR_SECRET_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }
});

async function importData() {
  try {
    console.log('JSON файлыг уншиж байна...');
    const filePath = path.join(__dirname, 'questions.json');
    const rawData = fs.readFileSync(filePath, 'utf8');
    const questions = JSON.parse(rawData);

    console.log(`Нийт ${questions.length} бодлого олдлоо. Supabase руу оруулж эхэллээ...`);

    // Багцын хэмжээг 20 болгож багасгав (сүлжээний тогтвортой байдлыг хангах үүднээс)
    const batchSize = 20;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('questions')
        .insert(batch);

      if (error) {
        console.error(`Алдаа гарлаа (${i} - ${i + batchSize}):`, error.message);
        // Хэрэв алдаа гарвал дэлгэрэнгүйг харуулах
        if (error.details) console.error('Дэлгэрэнгүй:', error.details);
      } else {
        console.log(`${Math.min(i + batchSize, questions.length)} / ${questions.length} бодлого амжилттай орлоо.`);
      }
    }

    console.log('Явц дууслаа!');
  } catch (err) {
    console.error('Системийн алдаа гарлаа:', err);
  }
}

importData();