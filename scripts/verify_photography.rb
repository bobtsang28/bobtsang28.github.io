require "yaml"

site = ARGV.fetch(0)
photos = YAML.safe_load_file("_data/photography_gallery.yml")
variants = YAML.safe_load_file("_data/photography_variants.yml")
paths = photos.map { |photo| photo.fetch("image") }
abort "Duplicate or missing photography entries" if paths.empty? || paths.uniq != paths
abort "Photography originals are present in the published site" if File.exist?(File.join(site, "images", "Photographs"))

html = File.read(File.join(site, "photography", "index.html"))
abort "Gallery item count does not match the data" unless html.scan('class="photography-gallery__item"').length == paths.length

paths.each do |path|
  metadata = variants.fetch(path)
  full_width = metadata.fetch("full_width").to_s
  %w[avif jpeg].each do |format|
    candidates = metadata.fetch(format)
    abort "Missing #{format} variants for #{path}" if candidates.empty?
    abort "Missing JPEG full-size variant for #{path}" if format == "jpeg" && !candidates.key?(full_width)
    candidates.each_value do |variant|
      abort "Missing published image: #{variant}" unless File.file?(File.join(site, variant.delete_prefix("/")))
      abort "Image not used by gallery: #{variant}" unless html.include?(variant)
    end
  end
end
puts "Verified #{paths.length} gallery entries and their published variants."
