#!/usr/bin/env ruby
# frozen_string_literal: true

# Ensure GoogleService-Info.plist is in the App target Resources so it ships in the IPA bundle.
# Writing the file alone is not enough — Xcode must reference it or Firebase can crash on launch.

require 'xcodeproj'

ROOT = File.expand_path('..', __dir__)
PROJECT_PATH = File.join(ROOT, 'ios', 'App', 'App.xcodeproj')
PLIST_REL = 'App/GoogleService-Info.plist'
PLIST_ABS = File.join(ROOT, 'ios', 'App', PLIST_REL)
INFO_PLIST = File.join(ROOT, 'ios', 'App', 'App', 'Info.plist')

abort("Missing Xcode project: #{PROJECT_PATH}") unless File.directory?(PROJECT_PATH)
abort("Missing GoogleService-Info.plist: #{PLIST_ABS}") unless File.file?(PLIST_ABS)

project = Xcodeproj::Project.open(PROJECT_PATH)
target = project.targets.find { |t| t.name == 'App' }
abort('App target not found in Xcode project') unless target

app_group = project.main_group.find_subpath('App', true)
existing = app_group.files.find do |f|
  path = f.path.to_s
  path == 'GoogleService-Info.plist' || path.end_with?('GoogleService-Info.plist')
end
file_ref = existing || app_group.new_file('GoogleService-Info.plist')

resources = target.resources_build_phase
already = resources.files.any? { |bf| bf.file_ref && bf.file_ref.uuid == file_ref.uuid }
resources.add_file_reference(file_ref) unless already

project.save
puts "Ensured GoogleService-Info.plist is in App target resources (#{PLIST_REL})"

# Ensure remote-notification background mode exists (idempotent).
if File.file?(INFO_PLIST)
  has_modes = system('/usr/libexec/PlistBuddy', '-c', 'Print :UIBackgroundModes', INFO_PLIST, out: File::NULL, err: File::NULL)
  system('/usr/libexec/PlistBuddy', '-c', 'Add :UIBackgroundModes array', INFO_PLIST) unless has_modes

  modes_out = ` /usr/libexec/PlistBuddy -c 'Print :UIBackgroundModes' "#{INFO_PLIST}" 2>/dev/null `
  unless modes_out.include?('remote-notification')
    # Append at next free index
    idx = 0
    loop do
      ok = system('/usr/libexec/PlistBuddy', '-c', "Print :UIBackgroundModes:#{idx}", INFO_PLIST, out: File::NULL, err: File::NULL)
      break unless ok
      idx += 1
      break if idx > 20
    end
    system('/usr/libexec/PlistBuddy', '-c', "Add :UIBackgroundModes:#{idx} string remote-notification", INFO_PLIST)
    puts 'Added UIBackgroundModes remote-notification'
  else
    puts 'UIBackgroundModes already includes remote-notification'
  end
end
