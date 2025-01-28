# https://mrinalcs.github.io/open-external-links-in-new-tab-in-jekyll

LINK = %Q{<a href="\\1" target="_blank" rel="nofollow noopener noreferrer"}.freeze

[:documents, :pages].each do |hook|
  Jekyll::Hooks.register hook, :post_render do |item|
    if item.output_ext == ".html"
      content = item.output
      site_url = Regexp.escape(item.site.config['url'])

      # Add rel="nofollow noopener noreferrer" to external anchor tags and ref parameter
      content.gsub!(
        %r{<a\s+href="((?!mailto:|tel:|#{site_url}|http://localhost:4000|/|#)[^"]+)"(?![^>]*rel=)},
        LINK
      )

      # Update the item content
      item.output = content
    end
  end
end
