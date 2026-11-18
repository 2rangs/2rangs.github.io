-- 강아지풀은 인간의 꼬리다, 이 닭을 아시나요: 에세이 → 헛소리
update blog_posts set tags = array['헛소리']::text[] where slug in ('foxtail-is-human-tail', 'do-you-know-this-chicken');
