import React from 'react';
import Helmet from 'react-helmet';

import { supportEmail } from 'config';

import './style.scss';


function TermsAndPolicies() {
  return (
    <React.Fragment>
      <Helmet>
        <title>Terms and Policies</title>
      </Helmet>
      <div className="row terms-policies">
        <div className="col-md-12">
          <h1>Terms and Policies</h1>

          <ul>
            <li><a href="#tos">Terms of Service</a></li>
            <li><a href="#privacy">Privacy Policy</a></li>
            <li><a href="#copyright">Copyright Policy</a></li>
          </ul>

          <div className="tos-div">
            <a name="tos">
              <h3>Terms of Service</h3>
            </a>
            <p>
              Use of the website <a href="/">http://webrecorder.io</a> (the “Site”) and the content and services provided through the Site is subject to the following terms and conditions.
            </p>
            <p>
              By using the Site, you accept and agree to be legally bound by these Terms of Service, whether or not you register for an account. If you are using the Site on behalf of an organization, you are agreeing to these Terms of Service for that organization and promising that you have authority to bind that organization to these Terms of Service. In that case, “you” and “your” will refer to the organization on behalf of which you are using the Site.
            </p>
            <p>If any of these Terms of Service is unacceptable to you, do not use the Site.</p>
            <p>The Site is operated by Rhizome Communications, Inc. and its staff (“Rhizome”) in support of its mission to advance digital preservation through the creation of free and open source software tools. As used in these Terms of Service, “we,” “us” and “our” refer to the Rhizome Webrecorder initiative and to Rhizome more generally.</p>
            <p>The Site helps its users create high fidelity, context-rich and interactive archives of the internet for use on their own copyright materials or for not-for-profit use of others materials. Through the Site, users can create and save web archives. Visitors to the Site can access user-created archives if they are made public. The services provided by us through or in connection with the Site are referred to collectively as the “Service.”</p>

            <ol className="tos">
              <li>
                <b>Changes to Terms of Service Are Binding; Other Policies</b>
                <ol className="tos-sub">
                  <li>We may change these Terms of Service from time to time without advance notice. Your use of the Site or Service after any changes have been made will constitute your agreement to the modified Terms of Service and all of the changes. Accordingly, you should read the Terms of Service from time to time for any changes. We will provide a link to the current Terms of Service on the Site, and will show the date on which the Terms of Service were last updated.</li>
                  <li>In addition to reviewing this Agreement, you should read our <a href="#privacy">Privacy Policy</a> and <a href="#copyright">Copyright Policy</a>. By using the Site or Service, you also accept these policies.</li>
                </ol>
              </li>
              <li>
                <b>Use of Site and Service</b>
                <ol className="tos-sub">
                  <li>You may use the Site and Service, including content stored at the direction of users, only for personal use or non-commercial research purposes that do not infringe or violate anyone’s copyright or other rights.</li>
                  <li>You agree to use the Site and the Service only in ways that comply with all applicable laws as well as these Terms of Service.</li>
                </ol>
              </li>
              <li>
                <b>Account Creation, Maintenance, and Termination</b>
                <ol className="tos-sub">
                  <li>In order to use certain portions of the Service, you will need to register with us and create an account. When registering for an account with us, you will be asked to provide personal information such as your name, email address, and institutional affiliation. You represent and warrant that all information provided in establishing an account, and at other points as required in the use of the Service, is current, accurate, and complete, and that you will maintain the accuracy and completeness of this information. If we previously terminated your account, you may not register for another account. You agree that we may contact you from time to time in reference to the Service.</li>
                  <li>As a registered account holder, you must maintain the confidentiality and security of your username(s) and password(s). You agree not to share, transfer, or authorize others to use your username and password or your account without our prior written approval. Any attempt to do so will be considered a violation of these Terms of Service.</li>
                  <li>You agree that you are solely responsible for all usage or activity on your account, including, but not limited to, use of the account by another person, with or without authorization. You agree to notify us immediately if you have reason to believe that your account is no longer secure.</li>
                  <li>We reserve the right to terminate or restrict access to your account and to delete or disable access to any links created and/or content stored in connection with the account, in our sole discretion, without advance notice, and shall have no liability for doing so. We will terminate your account in appropriate circumstances if you are determined to be a repeat infringer.</li>
                </ol>
              </li>
              <li>
                <b>Links to Third-Party Sites</b>
                <p>The Site and Service provide links to third-party websites (“Third Party Sites”). We do not control and have not reviewed all material made available through Third-Party Sites linked from the Site. We do not endorse, are not affiliated with, and are not responsible for the availability of Third-Party Sites. You agree that use of Third Party Sites is at the your own risk and that we have no responsibility or liability, directly or indirectly, for any content accessed at or any damage or losses you incur in connection with any Third-Party Site. We encourage you to be aware of the terms and conditions and privacy policies of any Third-Party Sites that you visit.</p>
              </li>

              <li>
                <b>User Submitted Content and Licensing</b>
                <ol className="tos-sub">
                  <li>Some portions of the Service enable users to direct us to store content ("User Submitted Content") and make it available. With respect to any and all User Submitted Content that you may direct us to store, you represent and warrant as follows:
                    <ol className="tos-sub-sub">
                      <li>that you lawfully acquired any User Submitted Content you provide us to upload;</li>
                      <li>that you have all rights necessary both to direct us to store the User Submitted Content and to grant any rights granted by you pursuant to these Terms of Service; and</li>
                      <li>that our storage, use, display and making available of the User Submitted Content in connection with the Service does not and will not infringe or violate the copyrights or other rights of any third party.</li>
                    </ol>
                  </li>
                  <li>You are solely responsible for any User Submitted Content you submit or direct us to store, and for the consequences of its being stored and made available as part of the Service.</li>
                  <li>By submitting User Submitted Content, furnishing a link or otherwise directing us to store or vest User Submitted Content, you grant us, under any rights that you hold therein, a perpetual, irrevocable, worldwide, non-exclusive, fully paid-up, royalty-free, sublicensable, and transferable license to use, reproduce, create derivative works based upon, transmit, distribute, perform, display, and make available the User Submitted Content, in any medium now in existence or later developed, in connection with the Service or otherwise in furtherance of our mission, including but not limited to promotional uses, and to authorize others to do the foregoing.</li>
                  <li>We reserve the right, but are not obligated, to monitor use of the Service and to review, modify, take down or delete any User Submitted Content, in our sole discretion, without notice, at any time. You may not be able to modify, take down or delete links or User Submitted Content that you direct us to store.</li>
                </ol>
              </li>

              <li>
                <b>Rules of Usage</b>
                <p>Use of the Service is subject to the following restrictions and obligations:</p>
                <ol className="tos-sub">
                  <li>You may not impersonate, imitate, or pretend to be someone else when using the Service.</li>
                  <li>You agree not to access links or content that you are not authorized to access.</li>
                  <li>You agree not to log into a server or account that you are not authorized to access.</li>
                  <li>You may not attempt to probe, scan or test the vulnerability of a system or network to breach security or authentication measures without authorization.</li>
                  <li>You may not disrupt, overwhelm, attack, modify, reverse engineer, or interfere with the Service or associated software or hardware in any way. You agree not to attempt to gain unauthorized access to our servers by any means – including, without limitation, by using administrator passwords or by posing as an administrator while using the Service or otherwise.</li>
                  <li>You are solely responsible for installing any anti-virus software or related protections against viruses, Trojan horses worms, time bombs, cancelbots or other computer programming routines or engines that are intended to damage, destroy, disrupt or otherwise impair a computer’s functionality or operation.</li>
                  <li>You must be 18 of age or older to use the Service, and fully competent to enter into and comply with these Terms of Use. If we learn that we have collected information from a child under the age of 13, we will delete that information promptly.</li>
                </ol>
              </li>

              <li>
                <b>Intellectual Property</b>
                <ol>
                  <li>The Site and much of the text, images, and other content of the Site are protected by copyright, trademark and other laws. We or others own the copyright and other rights in the Site, the Site content and the Service. All rights in the Site, the Site content and the Service that are not expressly granted are reserved.</li>
                  <li>You are granted no right or license to use any trademarks, service marks or logos displayed on the Site. Any use or registration of such marks – including but not limited to use in connection with any product or service in any way that is likely to cause confusion among customers or that disparages or discredits the mark owner – is prohibited.</li>
                  <li>We respect the intellectual property rights and other proprietary rights of others. If you believe that your copyright has been violated on the Site, please notify us as set forth in our <a href="#copyright">Copyright Policy</a>.</li>
                </ol>
              </li>

              <li>
                <b>Indemnity</b>
                <p>You agree to indemnify and hold harmless us, our affiliates, governing board members, officers, employees, agents and representatives, and any party with whom we may contract to provide the Service, from and against any claims, liabilities, losses, damages, costs and expenses, including but not limited to reasonable attorneys' fees and court costs, arising out of or in any way connected to your use of the Site or Service, including but not limited to any allegation or claim that, if true, reflects your violation of these Terms of Service or the infringement or violation by you (or occurring through use of your account) of any intellectual property or other right of any person or entity.</p>
              </li>

              <li>
                <b>Termination of Service</b>
                <p>We reserve the right at any time to modify, suspend or discontinue the Site or Service, in whole or in part, without notice, and shall have no liability for doing so.</p>
              </li>

              <li>
                <b>Disclaimer of Warranties; Limitations of Liability and Remedies</b>
                <ol className="tos-sub">
                  <li>WHILE WE ASPIRE TO PRESERVE LINKS AND ARCHIVAL COPIES OF CONTENT STORED AT THE DIRECTION OF USERS, WE MAKE NO REPRESENTATIONS, WARRANTIES, OR UNDERTAKINGS AS TO PERMANENCE OR THE DURATION OF PRESERVATION. AS INDICATED ELSEWHERE IN THESE TERMS OF USE, WE RESERVE THE RIGHT TO DELETE OR DISABLE ACCESS TO USER SUBMITTED CONTENT, AND TO TERMINATE ALL OR PART OF THE SERVICE AT ANY TIME. YOU ACKNOWLEDGE THAT STORED LINKS MAY FAIL TO WORK.</li>
                  <li>THE SITE AND THE CONTENT ARE PROVIDED ON AN “AS IS” AND “AS AVAILABLE” BASIS. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES OF ANY KIND (EXPRESS, IMPLIED OR OTHERWISE) REGARDING THE SITE, THE SERVICE OR ANY SITE CONTENT, INCLUDING BUT NOT LIMITED TO ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTY ABOUT THE ACCURACY, RELIABILITY, COMPLETENESS, TIMELINESS, SUFFICIENCY, QUALITY OR SECURITY OF THE SITE, THE SERVICE OR ANY SITE CONTENT. WE DO NOT APPROVE OR ENDORSE ANY USER SUBMITTED CONTENT OR CONTENT PROVIDED BY OTHERS. WE DO NOT WARRANT THAT THE SITE WILL OPERATE WITHOUT ERROR OR INTERRUPTION, OR THAT THE SITE OR ITS SERVER IS FREE OF COMPUTER VIRUSES OR OTHER HARMFUL MATERIALS.</li>
                  <li>WE MAKE THE SITE AND THE SERVICE AVAILABLE FREE OF CHARGE. YOUR USE OF THE SITE, THE SERVICE AND THE SITE CONTENT IS AT YOUR OWN SOLE RISK. IN NO EVENT SHALL WE BE LIABLE TO YOU, IN CONTRACT, TORT OR OTHERWISE, FOR ANY INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL, PUNITIVE OR EXEMPLARY DAMAGES ARISING OUT OF OR RELATING TO THE SITE, THE SERVICE OR ANY SITE CONTENT, OR YOUR USE THEREOF, OR THESE TERMS OF SERVICE, EVEN IF THE SITE, THE SERVICE OR ANY SITE CONTENT IS DEFECTIVE OR WE ARE NEGLIGENT OR OTHERWISE AT FAULT, AND REGARDLESS WHETHER WE ARE ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. IN NO EVENT SHALL WE BE LIABLE TO YOU, IN CONTRACT, TORT OR OTHERWISE, FOR AN AGGREGATE AMOUNT GREATER THAN FIFTY DOLLARS ($50) IN CONNECTION WITH THE SITE, THE SERVICE OR ANY SITE CONTENT, OR YOUR USE THEREOF, OR THESE TERMS OF USE, EVEN IF THE SITE, THE SERVICE OR ANY SITE CONTENT IS DEFECTIVE OR WE ARE NEGLIGENT OR OTHERWISE AT FAULT. THE FOREGOING LIMITATIONS ARE EACH INTENDED TO BE INDEPENDENTLY ENFORCEABLE, REGARDLESS WHETHER ANY OTHER REMEDY FAILS OF ITS ESSENTIAL PURPOSE, AND SHALL APPLY TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW.</li>
                </ol>
              </li>

              <li>
                <b>Governing Law and Jurisdiction; Access from Outside New York</b>
                <p>The Site is controlled and operated from our facilities in and around New York, NY. These Terms of Service, and any claim or dispute that arises from or relates to your use of the Site, the Service or any Site content, will be governed by the laws of the State of New York, U.S.A., without regard to its conflicts of laws principles that would require or permit the law of another jurisdiction to apply. You agree that all such claims and disputes will be heard and resolved exclusively in courts sitting in New York County, New York. You consent to the personal jurisdiction of such courts over you for this purpose, and waive and agree not to assert any objection to such proceedings in such courts (including any defense or objection of lack of proper jurisdiction or venue or inconvenience of forum). If you choose to access the Site or Service from locations other than New York, you will be responsible for compliance with all local laws of those other locations.</p>
              </li>

              <li>
                <b>General; Entire Agreement</b>
                <ol className="tos-sub">
                  <li>If any provision of these Terms of Use is held to be invalid or unenforceable, that provision, to the extent unenforceable, shall be struck, and shall not affect the validity or enforceability of the remaining provisions.</li>
                  <li>Your rights under these Terms of Service are personal, non-exclusive and non-transferable.</li>
                  <li>Headings are for reference purposes only and in no way define or limit the scope or extent of any provision of these Terms of Service.</li>
                  <li>Our failure to act with respect to a breach by you or others does not waive our right to act with respect to subsequent or similar breaches.</li>
                  <li>Nothing in these Terms of Service shall be deemed to confer any third-party rights or benefits.</li>
                  <li>These Terms of Use set forth the entire understanding and agreement between you and us with respect to the subject matter hereof, and supersede and replace any prior or contemporaneous understandings or agreements, whether written or oral, regarding the subject matter hereof.</li>
                </ol>
              </li>
            </ol>
            <div className="section-updated">These Terms of Service last updated August 8, 2016</div>
          </div>

          <div className="privacy">
            <a name="privacy">
              <h3>Privacy Policy</h3>
            </a>
            <ul className="privacy">
              <li>
                <b>Introduction</b>
                <p>This Privacy Policy discloses the information gathering and dissemination practices for the web site <a href="/">https://webrecorder.io/</a> (the “Site”) and the Webrecorder service (the “Service”).  The Site is operated by Rhizome Communications, Inc. and its staff (“Rhizome”) in support of its mission to advance digital preservation through the creation of free and open source software tools. As used in these Terms of Service, “we,” “us” and “our” refer to the Rhizome Webrecorder initiative and to Rhizome more generally.</p>
                <p>This Privacy Policy applies to information collected both from users who register to use the Service and from users who view the Site and use the Service without registering. By using the Site or Service, you are consenting to our collection and use of your information in accordance with this Privacy Policy.</p>
              </li>

              <li>
                <b>Important Terms Used Throughout This Privacy Policy</b>
                <p>Throughout this Privacy Policy we use several specialized terms. "Personally Identifiable Information" is information that tells us specifically who you are, like your name, street address, email address, billing address, credit card number, and expiration date. "User Information" means all Personally Identifiable Information and any other forms of information discussed in this Privacy Policy, including the Internet Protocol (“IP”) address of a user's computer. We use the term "aggregate" when we combine information from various persons or users. Information is said to be "anonymized" if it does not identify individual persons or entities or associate a particular person or entity with such information.</p>
              </li>

              <li>
                <b>Information We Collect and How We Use It</b>
                <p>If you visit our Site to browse, we will collect and store the domain name and host from which you accessed the Internet (e.g., example.com), the IP address of your computer, your browser software and operating system, the date and time you access the Site and the Internet address of any web site from which you linked directly to our Site or to which you link after visiting our Site. We use this information to measure the number of visitors to sections of our Site, to determine from where our visitors linked and to where our visitors link from the Site and to help us make the Service more useful. For example, we may organize and analyze IP addresses so that we can provide efficient service, enhance security, monitor appropriate usage and produce traffic volume statistics. This type of information is sometimes shared with third parties.</p>
                <p>To make full use of our Service, you may need to complete our registration process and create an account. We collect and store the Personally Identifiable Information you provide through this registration process, including your user ID and password. We collect and store information about when you create the account and when you log in. If you engage in a transaction while logged on to the Site, then we collect and store information about the transaction. If you send us communications, then we may collect such communications in a file specific to you.</p>
                <p>We use information we collect from you to provide and improve the Service. This may include building features that we hope will make the Service more attractive and easier for you and others to use. We also may use User Information to generate data and reports about usage of the Site and Service; to support the functioning and security of the Service and our network and systems; to protect our rights, property, or safety or those of others; for research; and for other purposes described in this Privacy Policy.</p>
                <p>We may share User Information with third parties in order to provide and improve the Service. For example, we may contract with third parties to perform functions and provide services to us, including, without limitation, hosting and maintenance of the Site, and may provide them User Information in that connection. We may also provide User Information to third parties in circumstances where we believe that doing so is necessary or appropriate to: satisfy any applicable law, regulation, legal process or governmental request; investigate compliance with or enforce our Terms of Service; detect, prevent or otherwise address fraud, illegal activity, security or technical issues; or protect the rights, property or safety of us, our users or others. The information we provide or share for these purposes may include Personally Identifiable Information. In addition, we may share aggregate anonymized data relating to activity on the Site and use of the Service, such as demographics and statistical information, for research and other purposes.</p>
              </li>

              <li>
                <b>If You Do Not Wish to Disclose User Information</b>
                <p>If you do not want to provide us with certain User Information then you may opt out by not using the Service or the part of the Service that provides us with such User Information. For example, if you do not want us to retain your name, then you may choose not to become a registered User. You will not be entitled to the benefits of registration, but you are still free to browse the Site and to visit the parts of the Site accessible to non-registrants. For example, you will be able to create temporary collections, but not persistent archives hosted on webrecorder.io.</p>
              </li>

              <li>
                <b>Local Storage</b>
                <p>The use of “local storage” permits our Site to send information to your browser for storage on your device. This feature can make your use of our Site easier by saving certain aspects about your status and preferences upon visits to our Site. For example, we use local storage to track the last recording name used to create a recording.</p>
              </li>

              <li>
                <b>Cookies</b>
                <p>The Site will attempt to store a small piece of data known as a “cookie” on your computer. The cookies are refreshed every time you enter the Site. Most browsers are initially set to accept cookies, but you may be able to change the settings to refuse cookies or to be alerted when cookies are being sent. We use cookies in some instances, to associate you with your User Information. For example, through the use of cookies you may log in automatically and thereby save you time. Rejection of cookies can interfere with your ability to log in and use certain parts of the Service.</p>
              </li>

              <li>
                <b>Control of Your Password</b>
                <p>Except as specifically permitted by this Privacy Policy or the Terms of Service, you may not disclose your Webrecorder password to any third parties nor share it with any third-parties. If you lose control of your Webrecorder password you may lose control over your Personally Identifiable Information, and you will be responsible for any legally binding actions taken on your behalf. Therefore, if your password has been compromised for any reason, you should immediately change your password or, if we provided your password, notify us so that we may issue you a new password.</p>
              </li>

              <li>
                <b>Third Parties</b>
                <p>This Privacy Policy only addresses the use and disclosure of User Information collected by us in connection with the Webrecorder Service. If you disclose information to other parties, different rules may apply to their use or disclosure of such information regardless of their affiliation or relationship with us. We are not responsible for the privacy practices or content of other web sites. When you link to another web site or are recording another web site, you are subject to the privacy policy of that web site. We encourage you to be aware when you are leaving our Site and to review any applicable privacy policies before you disclose your personal information to third parties.</p>

                <b>Recording Proxy and Third Party Content</b>
                <p>The purpose of Webrecorder is to record remote website traffic (Third Party Content) on behalf of the user. As such, any content entered into Webrecorder will be transmitted through the Webrecorder service and recorded into a web archive, controlled by the user. If a user enters Personally Identifiable Information for the purpose of recording Third Party Content, that information may be recorded. Webrecorder will in most cases attempt to exclude user-submitted passwords and cookies from recordings, but does not guarantee that such attempts will always succeed. Even when not recorded, Personally Identifiable Information entered in the course of using Webrecorder may be transmitted through the Webrecorder proxy system.</p>

                <b>Third Party Disclaimer</b>
                <p>We do not try to control, and disclaim responsibility for, information provided by other users or third-parties that is made available through our site. Such information may contain errors, intentional or otherwise, or may be offensive, inappropriate or inaccurate, and in some cases may be mislabeled or deceptively labeled.</p>
                <p>Webrecorder uses services provided by third-party service providers, such as Amazon Web Services (which provides computing and storage services). You may wish to review their privacy policies as well.</p>
              </li>

              <li>
                <b>Changes to this Policy</b>
                <p>We may change this Privacy Policy from time to time with or without notice, so please check it regularly for any changes or updates. For future reference, Webrecorder will make a link to the current Privacy Policy available to you when you are on our Site.</p>
              </li>

              <li>
                <b>How do I contact Webrecorder?</b>
                <p>If you have any questions regarding this Privacy Policy, you can contact us by sending an email to <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
              </li>
            </ul>
            <p className="section-updated">This Privacy Policy was last updated August 8, 2016</p>
          </div>

          <div className="copyright">
            <a name="copyright">
              <h3>Copyright Policy</h3>
            </a>
            <p>Consistent with the Digital Millennium Copyright Act, if you believe that your copyrighted materials have been copied in a way that constitutes copyright infringement, please send an email or written notice to the designated agent, with:</p>
            <ol>
              <li>A physical or electronic signature of person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed;</li>
              <li>Identification of the copyrighted work claimed to have been infringed;</li>
              <li>Identification of the material that is claimed to be infringing or to be the subject of infringing activity and that is to be removed or access to which is to be disabled, and information reasonably sufficient to permit Webrecorder to locate the material;</li>
              <li>Information reasonably sufficient to permit Webrecorder to contact the complaining party, such as an address, telephone number, and if available, an electronic mail address at which the complaining party may be contacted;</li>
              <li>A statement that the complaining party has a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law; and</li>
              <li>A statement that the information in the notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
            </ol>

            <p>Webrecorder’s designated agent for notice for claims of copyright infringement is Lauren Studebaker, who can be reached as follows:</p>
            <ul>
              <li>By mail: Rhizome, 235 Bowery, New York, NY 10002</li>
              <li>By phone: 212-219-1288 x302</li>
              <li>By email: lauren.studebaker(at)rhizome.org</li>
            </ul>

            <p>Note: the above contact information is provided exclusively for notifying Webrecorder that your copyrighted material may have been infringed. All other inquiries, (e.g., requests for technical assistance or customer service, reports of email abuse, and piracy reports), will not receive a response through this process and should be directed to the appropriate entity via email or by phone.</p>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

export default TermsAndPolicies;
