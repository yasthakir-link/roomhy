import React from "react";
import WebsiteFooter from "../../components/website/WebsiteFooter";
import { useHtmlPage } from "../../utils/htmlPage";
import { useHeroSlideshow, useWebsiteCommon, useWebsiteMenu } from "../../utils/websiteUi";

export default function WebsiteProfile() {
  useWebsiteCommon();
  useWebsiteMenu();
  useHeroSlideshow();

  useHtmlPage({
    title: "Profile Settings - Roomhy",
    bodyClass: "text-gray-800",
    htmlAttrs: {
  "lang": "en",
  "class": "scroll-smooth"
},
    metas: [
  {
    "charset": "UTF-8"
  },
  {
    "name": "viewport",
    "content": "width=device-width, initial-scale=1.0"
  }
],
    bases: [],
    links: [
  {
    "rel": "preconnect",
    "href": "https://fonts.googleapis.com"
  },
  {
    "rel": "preconnect",
    "href": "https://fonts.gstatic.com",
    "crossorigin": true
  },
  {
    "href": "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    "rel": "stylesheet"
  },
  {
    "rel": "stylesheet",
    "href": "/website/assets/css/profile.css"
  }
],
    styles: [],
    scripts: [
  {
    "src": "https://cdn.tailwindcss.com"
  },
  {
    "src": "https://unpkg.com/lucide@latest"
  }
],
    inlineScripts: []
  });

  return (
    <div className="html-page">
      
      
          <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-sm shadow-sm">
              <div className="container mx-auto px-4 sm:px-6">
                  <div className="flex h-20 items-center justify-between">
                      
                      <div className="flex items-center">
                          <a href="/website/index" className="flex-shrink-0">
                              <img src="https://res.cloudinary.com/dpwgvcibj/image/upload/v1768990260/roomhy/website/logoroomhy.png" alt="Roomhy Logo" className="h-10 w-25" />
                          </a>
                      </div>
                      
                      <div className="flex items-center gap-3 sm:gap-6">
                          <nav className="hidden lg:flex items-center space-x-6">
                              <a href="/website/about" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">About Us</a>
                              <a href="/website/contact" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Contact</a>
                          </nav>
      
                          <a href="/website/list" className="flex-shrink-0 flex items-center space-x-1 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                              <i data-lucide="plus-circle" className="w-4 h-4"></i>
                              <span>Post <span className="hidden sm:inline">Your</span> Property</span>
                          </a>
                          
                          <button id="menu-toggle" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                              <i data-lucide="menu" className="w-7 h-7 text-gray-800"></i>
                          </button>
                      </div>
      
                  </div>
              </div>
          </header>
          <section className="relative py-20 md:py-28 text-white">
              <div id="hero-image-wrapper" className="absolute inset-0 w-full h-full overflow-hidden">
                  
                  <img src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1980&auto:format&fit=crop" alt="Hero background 1" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out animate-kenburns opacity-100" />
                  
                  <img src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto:format&fit=crop" alt="Hero background 2" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out animate-kenburns opacity-0" />
                  
                  <img src="https://images.unsplash.com/photo-1494203484021-3c454daf695d?q=80&w=2070&auto:format&fit=crop" alt="Hero background 3" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out animate-kenburns opacity-0" />
      
                  <div className="absolute inset-0 w-full h-full bg-black/60"></div> 
              </div>
      
              <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
                  <h1 className="text-4xl md:text-5xl font-bold text-shadow mb-4" style={{ color: "#fffcf2" }}>
                      Profile Settings
                  </h1>
                  <p className="text-lg text-gray-200 max-w-2xl mx-auto mb-6">
                      Manage your account settings and preferences.
                  </p>
      
                  <div className="relative w-full max-w-2xl mx-auto">
                      <input type="text" placeholder="Search for 'PG near me' or 'Hostel in Kota'" className="w-full p-4 pl-5 pr-14 rounded-lg bg-white text-gray-900 border-transparent focus:ring-4 focus:ring-cyan-300/50 focus:outline-none placeholder-gray-500 shadow-lg" />
                      <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                          <i data-lucide="search" className="w-5 h-5 text-white"></i>
                      </button>
                  </div>
                  </div>
          </section>
          <div id="menu-overlay" className="fixed inset-0 bg-black/50 z-40 hidden"></div>
          
          <div id="mobile-menu" className="fixed top-0 right-0 w-80 h-full bg-white z-50 shadow-xl transform translate-x-full transition-transform duration-300 ease-in-out flex flex-col">
              <div className="flex justify-end p-4 flex-shrink-0">
                  <button id="menu-close" className="p-2">
                      <i data-lucide="x" className="w-6 h-6 text-gray-700"></i>
                  </button>
              </div>
      
              
              <div id="menu-logged-in" className="hidden flex flex-col h-full">
                  <div className="flex justify-between items-center px-6 py-2">
                      <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                              <i data-lucide="user" className="w-6 h-6 text-white"></i>
                          </div>
                          <div>
                              <span className="text-lg font-semibold text-gray-800" id="welcomeUserName">Hi,welcome</span>
                              <p className="text-xs text-gray-500" id="userIdDisplay"></p>
                          </div>
                      </div>
                      <a href="/website/profile" className="text-sm font-medium text-blue-600 hover:underline">Profile</a>
                  </div>
      
                  <div className="px-6 py-4">
                      <div className="border border-blue-200 rounded-lg p-4 relative overflow-hidden">
                          <p className="font-semibold text-gray-800 mb-3 relative z-10">Looking to Sell/Rent your Property?</p>
                          <a href="/website/list" className="block text-center w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors relative z-10">
                              Post Property for Free
                          </a>
                      </div>
                  </div>
      
                  <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
                      <a href="/website/ourproperty" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="home" className="w-5 h-5 text-blue-600"></i>
                          </div>
                          <span>Our Properties</span>
                      </a>
                      <a href="/website/fav" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="heart" className="w-5 h-5 text-red-600"></i>
                          </div>
                          <span>Favorites</span>
                      </a>
                      <a href="/website/mystays" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="building" className="w-5 h-5 text-purple-600"></i>
                          </div>
                          <span>My Stays</span>
                      </a>
                      <a href="/website/about" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="info" className="w-5 h-5 text-yellow-600"></i>
                          </div>
                          <span>About Us</span>
                      </a>
                      <a href="/website/contact" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="phone" className="w-5 h-5 text-cyan-600"></i>
                          </div>
                          <span>Contact Us</span>
                      </a>
                      <a href="/website/websitechat" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="message-circle" className="w-5 h-5 text-green-600"></i>
                          </div>
                          <span>Chat</span>
                      </a>
                  </nav>
                  
                  <div className="p-4 border-t flex-shrink-0">
                      <button onClick={function(event) { try { return Function('event', "globalLogout()").call(event.currentTarget, event); } catch (err) { console.error(err); } }} className="w-full flex items-center space-x-4 p-3 rounded-lg text-red-600 hover:bg-red-50">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="log-out" className="w-5 h-5 text-gray-600"></i>
                          </div>
                          <span>Logout</span>
                      </button>
                  </div>
              </div>
      
              
              <div id="menu-logged-out" className="flex flex-col h-full">
                  <div className="flex-grow p-4 space-y-1 overflow-y-auto">
                      <a href="/website/about" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="info" className="w-5 h-5 text-yellow-600"></i>
                          </div>
                          <span>About Us</span>
                      </a>
                      <a href="/website/contact" className="flex items-center space-x-4 p-3 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600">
                          <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                              <i data-lucide="phone" className="w-5 h-5 text-cyan-600"></i>
                          </div>
                          <span>Contact Us</span>
                      </a>
                  </div>
                  
                  <div className="p-4 space-y-3 border-t flex-shrink-0">
                      <a href="/website/login" className="block w-full text-center bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                          <i data-lucide="log-in" className="w-4 h-4 inline mr-2"></i>
                          Login
                      </a>
                      <a href="/website/signup" className="block w-full text-center border-2 border-blue-600 text-blue-600 font-medium py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors">
                          <i data-lucide="user-plus" className="w-4 h-4 inline mr-2"></i>
                          Sign Up
                      </a>
                  </div>
              </div>
          </div>
         
          <main className="container mx-auto px-4 sm:px-6 py-8 md:py-12">
      
              <div className="mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Profile Settings</h1>
                  <p className="text-lg text-gray-600 mt-2">Manage your account settings and preferences.</p>
              </div>
      
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
                  <form action="#" method="POST">
                      
                      <div className="form-section p-6 md:p-8">
                          <h2 className="form-section-title">
                              <i data-lucide="user-circle-2" className="text-blue-600"></i>
                              Profile Settings
                          </h2>
                          <p className="text-gray-600 -mt-4 mb-6">Update your profile information, including name, profile picture, and personal details.</p>
      
                          <div className="mb-6">
                              <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Picture</h3>
                              <div className="flex items-center gap-4">
                                  <span className="inline-block h-20 w-20 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-blue-600 text-3xl font-bold">
                                      YF
                                  </span>
                                  <div>
                                      <button type="button" className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium">
                                          <i data-lucide="camera" className="w-4 h-4"></i>
                                          Change Photo
                                      </button>
                                      <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF. Max size 5MB.</p>
                                  </div>
                              </div>
                          </div>
      
                          <div>
                              <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                      <label htmlFor="first-name" className="form-label">First Name</label>
                                      <input type="text" id="first-name" name="first-name" className="form-input" value="Yasmine" />
                                  </div>
                                  <div>
                                      <label htmlFor="last-name" className="form-label">Last Name</label>
                                      <input type="text" id="last-name" name="last-name" className="form-input" value="Fathima" />
                                  </div>
                                  <div>
                                      <label htmlFor="gender" className="form-label">Gender</label>
                                      <select id="gender" name="gender" className="form-input">
                                          <option>Male</option>
                                          <option>Female</option>
                                          <option>Other</option>
                                          <option>Prefer not to say</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label htmlFor="email" className="form-label">Email Address</label>
                                      <input type="email" id="email" name="email" className="form-input" value="yasminefathma0401@gmail.com" disabled />
                                  </div>
                                  <div className="md:col-span-2">
                                      <label htmlFor="phone" className="form-label">Phone Number</label>
                                      <input type="tel" id="phone" name="phone" className="form-input" placeholder="Enter your phone number" />
                                  </div>
                              </div>
                          </div>
                      </div>
      
                      <div className="form-section p-6 md:p-8">
                          <h2 className="form-section-title">
                              <i data-lucide="shield-alert" className="text-orange-600"></i>
                              Emergency Contact
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <label htmlFor="emergency-name" className="form-label">Emergency Contact Name</label>
                                  <input type="text" id="emergency-name" name="emergency-name" className="form-input" placeholder="Enter emergency contact name" />
                              </div>
                              <div>
                                  <label htmlFor="emergency-phone" className="form-label">Emergency Phone Number</label>
                                  <input type="tel" id="emergency-phone" name="emergency-phone" className="form-input" placeholder="Enter emergency contact phone" />
                              </div>
                              <div className="md:col-span-2">
                                  <label htmlFor="relationship" className="form-label">Relationship</label>
                                  <select id="relationship" name="relationship" className="form-input">
                                      <option value disabled selected>Select relationship</option>
                                      <option>Parent</option>
                                      <option>Guardian</option>
                                      <option>Sibling</option>
                                      <option>Friend</option>
                                      <option>Other</option>
                                  </select>
                              </div>
                          </div>
                      </div>
      
                      <div className="form-section p-6 md:p-8">
                          <h2 className="form-section-title">
                              <i data-lucide="book-user" className="text-purple-600"></i>
                              General Information
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="md:col-span-2">
                                  <label htmlFor="permanent-address" className="form-label">Permanent Address</label>
                                  <textarea id="permanent-address" name="permanent-address" rows="3" className="form-input" placeholder="Enter your permanent address"></textarea>
                              </div>
                              <div>
                                  <label htmlFor="address-proof" className="form-label">Current Address Proof</label>
                                  <input type="text" id="address-proof" name="address-proof" className="form-input" placeholder="Enter proof document type" />
                              </div>
                              <div>
                                  <label htmlFor="profession" className="form-label">Profession</label>
                                  <input type="text" id="profession" name="profession" className="form-input" placeholder="Enter your profession" />
                              </div>
                          </div>
                      </div>
      
                      <div className="form-section p-6 md:p-8">
                          <h2 className="form-section-title">
                              <i data-lucide="lock" className="text-red-600"></i>
                              Change Password
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <label htmlFor="new-password" className="form-label">New Password</label>
                                  <input type="password" id="new-password" name="new-password" className="form-input" placeholder="********" />
                              </div>
                              <div>
                                  <label htmlFor="confirm-password" className="form-label">Confirm Password</label>
                                  <input type="password" id="confirm-password" name="confirm-password" className="form-input" placeholder="Confirm new password" />
                              </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-3">Leave password fields empty if you don't want to change your password.</p>
                      </div>
      
                      <div className="p-6 md:p-8 bg-gray-50/50 rounded-b-2xl flex justify-end items-center gap-4">
                          <button type="button" className="bg-white text-gray-700 px-5 py-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-sm">
                              Cancel
                          </button>
                          <button type="submit" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                              Update Profile
                          </button>
                      </div>
      
                  </form>
              </div>
              
          </main>
          <a
              href="/website/fast-bidding"
              className="group fixed bottom-5 right-5 z-50 flex max-w-[13rem] items-center gap-3 overflow-hidden rounded-[28px] border border-slate-950 bg-slate-950 px-3 py-3 text-white shadow-[0_20px_50px_rgba(15,23,42,0.2)] transition-all duration-300 hover:-translate-y-1 hover:bg-black hover:shadow-[0_24px_60px_rgba(15,23,42,0.26)] sm:max-w-none"
          >
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_45%)] opacity-80"></span>
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-sm">
                  <i data-lucide="gavel" className="h-7 w-7 transition-transform duration-300 group-hover:rotate-[-10deg] group-hover:scale-110"></i>
              </span>
              <span className="relative flex flex-col leading-tight">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Roomhy</span>
                  <span className="text-base font-extrabold">Fast Bidding</span>
                  <span className="hidden text-xs text-slate-300 sm:block">Get rooms within your budget</span>
              </span>
              <span className="relative ml-1 hidden h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition-transform duration-300 group-hover:translate-x-1 sm:flex">
                  <i data-lucide="arrow-right" className="h-5 w-5"></i>
              </span>
          </a>
          <WebsiteFooter />
          
          
    </div>
  );
}
