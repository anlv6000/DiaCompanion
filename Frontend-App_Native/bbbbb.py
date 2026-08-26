import re

Paragraph = "Python is popular. NLP uses Python! Is Java useful?"

# Pattern tìm mã môn học
pattern = r'\b[w*python]\b'

# Trích xuất
course_codes = re.findall(pattern, Paragraph)

print(pattern(Paragraph))