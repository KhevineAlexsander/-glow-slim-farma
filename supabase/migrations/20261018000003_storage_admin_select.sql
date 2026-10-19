-- A API de storage localiza o arquivo (SELECT sob RLS) antes de alterá-lo ou excluí-lo.
-- Sem esta política o admin não consegue remover imagens antigas.
-- A leitura pública continua funcionando pela URL pública do bucket.
create policy "store-images: admin lê"
  on storage.objects for select to authenticated
  using (bucket_id = 'store-images' and public.is_admin());
