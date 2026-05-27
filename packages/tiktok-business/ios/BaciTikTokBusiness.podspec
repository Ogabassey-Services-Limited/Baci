require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'BaciTikTokBusiness'
  s.version        = package['version']
  s.summary        = 'Baci bridge for the official TikTok Business iOS SDK'
  s.description    = 'Expo native module that initializes and tracks events with TikTokBusinessSDK.'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'Baci'
  s.homepage       = 'https://github.com/tiktok/tiktok-business-ios-sdk'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.4'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'TikTokBusinessSDK', '1.6.1'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
